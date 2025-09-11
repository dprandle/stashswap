import { type Request, type Response, type NextFunction, Router } from "express";
import { MongoClient, Collection } from "mongodb";
import bc from "bcrypt";
import jwt from "jsonwebtoken";

import { send_status_error } from "./error.js";
import type { bsyr_user, bsyr_user_resp } from "./users.js";

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY!;
asrt(SECRET_JWT_KEY);

declare global {
  namespace Express {
    interface Request {
      liuser?: jwt.JwtPayload | string | undefined;
    }
  }
}

// Authentication middleware to verify JWT tokens
function authenticate_jwt(req: Request, res: Response, next: NextFunction) {
  const use_html: boolean = req.accepts('html') === 'html';
  if (use_html) {
    res.set('Vary', "Accept");
  }

  // For html requests we store credentials in cookies so make sure we have something there
  if (use_html && (!req.cookies || !req.cookies.token)) {
    let token_str = "";
    if (req.cookies && "token" in req.cookies) {
      token_str = req.cookies.token as string;
    }
    send_status_error(200, new Error(`User credentials have not been provided (token: ${token_str})`), res, use_html);
    return;
  }

  // This is to later have the token from any mobile device token
  let token: any = {};
  if (use_html) {
    token = req.cookies.token;
  }

  // When verification completes we either return invalid creds
  const on_verify_function = (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {
    if (err) {
      const stat_err = new Error("Invalid credentials");
      stat_err.cause = err;
      send_status_error(200, stat_err, res, use_html);
    }
    if (decoded) {
      req.liuser = decoded; // Attach user info to request object
    }
    next();
  };

  jwt.verify(token, SECRET_JWT_KEY, on_verify_function);
}

export function authenticate_user_and_respond(user: bsyr_user, message: string, res: Response, html_resp: boolean) {
  ilog(`${user.username} (${user.email}) logged in successfully`);
  
  const payload: bsyr_user_resp = {
    id: user._id.toString(),
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
  };
  const token = jwt.sign(payload, SECRET_JWT_KEY, { expiresIn: "1h" });

  if (html_resp) {
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true if using https
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    // On login, we want to show the user dashboard, and not a json message
    res.type('html').send("<h2>Logged in</h2>");
  }
  else {
    res.json({ message: message, user: payload, token: token});
  }
    
}

// Search for the user by the passed in email (checks both username and email fields),
// if there is a match, check the matches password against the hashed password passed in
function authenticate_user_or_fail(
  email: string,
  plaint_text_pwd: string,
  users: Collection<bsyr_user>,
  res: Response,
  use_html: boolean
) {
  // Find user call completes (found or not found user)
  const on_find_user_resolved = (result: bsyr_user | null) => {
    // If we find the user then check the password - we pass the plain text password to bcrpy which internall hashes it and does some kind
    // of compare algorithm against the hashed one stored in the db
    if (result) {
      const on_hash_comp_resolved = (match: boolean) => {
        if (match) {
          authenticate_user_and_respond(result, "Login successful", res, use_html);
        } else {
          send_status_error(200, "Incorrect password", res, use_html);
        }
      };
      const on_hash_comp_rejected = (reason: any) => {
        send_status_error(500, reason, res, use_html);
      };
      const hash_comp_prom = bc.compare(plaint_text_pwd, result.pwd);
      hash_comp_prom.then(on_hash_comp_resolved, on_hash_comp_rejected);
    } else {
      send_status_error(200, "User not found", res, use_html);
    }
  };

  // If find one fails it means an internal server (connection most likely) error
  const on_find_user_rejected = (reason: any) => {
    send_status_error(500, reason, res, use_html);
  };
  // This is an easy way to allow the user to either supply their username or email as input
  const fprom = users.findOne({ email: email });
  fprom.then(on_find_user_resolved, on_find_user_rejected);
}

export function create_auth_routes(mongo_client: MongoClient): Router {
  const db = mongo_client.db(process.env.DB_NAME);
  const coll_name = process.env.USER_COLLECTION_NAME!;
  const users = db.collection<bsyr_user>(coll_name);

  // LOGIN
  const login = (req: Request, res: Response) => {
    // desctructuring - pull username from body and store it as unsername_or_email, and pwd as plain_text_pwd
    const { email: email, pwd: plain_text_pwd } = req.body;

    const use_html: boolean = req.accepts('html') === 'html';
    if (use_html) {
      res.set('Vary', "Accept");
    }

    // We require both of these to attempt login
    if (!email || !plain_text_pwd) {
      send_status_error(200, "Username and password are required", res, use_html);
      return;
    }

    // The final result of this function is to send a response to the client
    authenticate_user_or_fail(email, plain_text_pwd, users, res, use_html);
  };

  // LOGOUT
  const logout = (req: Request, res: Response) => {
    const use_html: boolean = req.accepts('html') === 'html';
    if (use_html) {
      res.set('Vary', "Accept");
    }

    if (use_html) {
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
      });
      res.type('html').send("<h1>Logged out!</h1>");
    }
    else {
      res.json({ message: "Logged out!" });      
    }
  };

  const dummy_login = (_req: Request, res: Response) => {
    res.status(204).send();
  };

  const me = (req: Request, res: Response) => {
    res.json(req.liuser);
  };

  const auth_router = Router();
  auth_router.post("/login", login);
  auth_router.post("/logout", logout);
  auth_router.post("/dummy-login", dummy_login);
  auth_router.get("/me", authenticate_jwt, me);

  return auth_router;
}
