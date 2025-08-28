import { send_status_error } from "./error";
import { Request, Response, NextFunction, Router } from "express";
import { MongoClient, Collection } from "mongodb";
import { bsyr_user, bsyr_user_resp } from "./users";
import bc from "bcrypt";
import jwt from "jsonwebtoken";

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY!;

declare global {
  namespace Express {
    interface Request {
      liuser?: jwt.JwtPayload | string | undefined;
    }
  }
}

// Authentication middleware to verify JWT tokens
function authenticate_jwt(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies || !req.cookies.token) {
    let token_str = "";
    if (req.cookies && "token" in req.cookies) {
      token_str = req.cookies.token as string;
    }
    send_status_error(401, new Error(`User credentials have not been provided (token: ${token_str})`), res);
    return;
  }

  const on_verify_function = (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {
    if (err) {
      const stat_err = new Error("Invalid credentials");
      stat_err.cause = err;
      send_status_error(403, stat_err, res);
    }
    if (decoded) {
      req.liuser = decoded; // Attach user info to request object
    }
    next();
  };

  jwt.verify(req.cookies.token, SECRET_JWT_KEY, on_verify_function);
}

export function authenticate_user_and_respond(user: bsyr_user, message: string, res: Response) {
  ilog(`${user.username} (${user.email}) logged in successfully`);

  const payload: bsyr_user_resp = {
    id: user._id.toString(),
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
  };
  const token = jwt.sign(payload, SECRET_JWT_KEY, { expiresIn: "1h" });

  res.cookie("token", token, {
    httpOnly: true,
    secure: false, // true if using https
    sameSite: "strict",
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.json({ message: message, user: payload });
}

// Search for the user by the passed in username_or_email (checks both username and email fields),
// if there is a match, check the matches password against the hashed password passed in
function authenticate_user_or_fail(
  username_or_email: string,
  plaint_text_pwd: string,
  users: Collection<bsyr_user>,
  res: Response
) {
  // Find user call completes (found or not found user)
  const on_find_user_resolved = (result: bsyr_user | null) => {
    // If we find the user then check the password - we pass the plain text password to bcrpy which internall hashes it and does some kind
    // of compare algorithm against the hashed one stored in the db
    if (result) {
      const on_hash_comp_resolved = (match: boolean) => {
        if (match) {
          authenticate_user_and_respond(result, "Login successful", res);
        } else {
          send_status_error(400, "Incorrect password", res);
        }
      };
      const on_hash_comp_rejected = (reason: any) => {
        send_status_error(500, reason, res);
      };
      const hash_comp_prom = bc.compare(plaint_text_pwd, result.pwd);
      hash_comp_prom.then(on_hash_comp_resolved, on_hash_comp_rejected);
    } else {
      send_status_error(400, "User not found", res);
    }
  };

  // If find one fails it means an internal server (connection most likely) error
  const on_find_user_rejected = (reason: any) => {
    send_status_error(500, reason, res);
  };
  // This is an easy way to allow the user to either supply their username or email as input
  const fprom = users.findOne({ $or: [{ username: username_or_email }, { email: username_or_email }] });
  fprom.then(on_find_user_resolved, on_find_user_rejected);
}

export function create_auth_routes(mongo_client: MongoClient): Router {
  const db = mongo_client.db(process.env.DB_NAME);
  const coll_name = process.env.USER_COLLECTION_NAME!;
  const users = db.collection<bsyr_user>(coll_name);

  // LOGIN
  const login = (req: Request, res: Response) => {
    // desctructuring - pull username from body and store it as unsername_or_email, and pwd as plain_text_pwd
    const { username: username_or_email, pwd: plain_text_pwd } = req.body;

    // We require both of these to attempt login
    if (!username_or_email || !plain_text_pwd) {
      send_status_error(400, "Username and password are required", res);
      return;
    }

    // The final result of this function is to send a response to the client
    authenticate_user_or_fail(username_or_email, plain_text_pwd, users, res);
  };

  // LOGOUT
  const logout = (_req: Request, res: Response) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });
    res.json({ message: "Logged out!" });
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
