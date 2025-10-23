import { type Request, type Response, type NextFunction, Router } from "express";
import { MongoClient, Collection } from "mongodb";
import bc from "bcrypt";
import jwt from "jsonwebtoken";

import template, { render_fragment } from "../template.js";
import { send_err_resp } from "./error.js";
import type { ss_user } from "./users.js";

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY!;
asrt(SECRET_JWT_KEY);

declare global {
    namespace Express {
        interface Request {
            liuser?: jwt.JwtPayload | string | undefined;
        }
    }
}

type user_callback = (user: ss_user | null, err: string | null) => void;

function get_user_from_token(token: string, callback: user_callback) {
    // When verification completes we either return invalid creds
    const on_verify_function = (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {
        if (err) {
            callback(null, "Invalid credentials");
        }
        if (decoded) {
            callback(decoded as ss_user, null);
        }
    };
    jwt.verify(token, SECRET_JWT_KEY, on_verify_function);
}

export function send_unauthorized_response(res: Response) {
    const signin_html = template.render_fragment("signin.html", {hidden_class: " hidden"});
    const index_with_signin = template.render_fragment("index.html", {sign_in_fragment: signin_html});
    res.status(200).type("html").send(index_with_signin);
}

// This can be used as "middleware" for protected routes. Just understand that failure returns a 401 response which, when using htmx,
// will return the errmsg fragment.
export function verify_liuser(req: Request, res: Response, next: NextFunction) {
    if (req.cookies.token) {
        const token_done_func = (usr: ss_user | null, err: string | null) => {
            if (usr) {
                req.liuser = usr;
                next();
            } else {
                ilog("Failed to verify user: ", err);
                send_unauthorized_response(res);
            }
        };
        get_user_from_token(req.cookies.token, token_done_func);
    } else {
        send_unauthorized_response(res);
    }
}

export function authenticate_user_and_respond(user: ss_user, message: string, res: Response) {
    ilog(`${user.username} (${user.email}) logged in successfully`);

    const token = jwt.sign(user, SECRET_JWT_KEY, { expiresIn: "1h" });

    res.cookie("token", token, {
        httpOnly: true,
        secure: false, // true if using https
        sameSite: "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
    });

    // On login, we want to show the user dashboard, and not a json message
    setTimeout(() => {
        res.type("html").send(
            render_fragment("log-in-success.html", {
                first_name: user.first_name,
            })
        );
    }, 1000);
}

// Search for the user by the passed in email (checks both username and email fields),
// if there is a match, check the matches password against the hashed password passed in
function authenticate_user_or_fail(email: string, plaint_text_pwd: string, users: Collection<ss_user>, res: Response) {
    // Find user call completes (found or not found user)
    const on_find_user_resolved = (result: ss_user | null) => {
        // If we find the user then check the password - we pass the plain text password to bcrpy which internall hashes it and does some kind
        // of compare algorithm against the hashed one stored in the db
        if (result) {
            const on_hash_comp_resolved = (match: boolean) => {
                if (match) {
                    authenticate_user_and_respond(result, "Login successful", res);
                } else {
                    send_err_resp(200, "Incorrect password", res);
                }
            };
            const on_hash_comp_rejected = (reason: any) => {
                send_err_resp(500, reason, res);
            };
            const hash_comp_prom = bc.compare(plaint_text_pwd, result.pwd);
            hash_comp_prom.then(on_hash_comp_resolved, on_hash_comp_rejected);
        } else {
            send_err_resp(200, "User not found", res);
        }
    };

    // If find one fails it means an internal server (connection most likely) error
    const on_find_user_rejected = (reason: any) => {
        send_err_resp(500, reason, res);
    };
    // This is an easy way to allow the user to either supply their username or email as input
    const fprom = users.findOne({ email: email });
    fprom.then(on_find_user_resolved, on_find_user_rejected);
}

export function create_auth_routes(mongo_client: MongoClient): Router {
    const db = mongo_client.db(process.env.DB_NAME);
    const coll_name = process.env.USER_COLLECTION_NAME!;
    const users = db.collection<ss_user>(coll_name);

    // LOGIN
    const login = (req: Request, res: Response) => {
        // desctructuring - pull username from body and store it as unsername_or_email, and pwd as plain_text_pwd
        const { email: email, pwd: plain_text_pwd } = req.body;
        if (!email || !plain_text_pwd) {
            send_err_resp(200, "Username and password are required", res);
            return;
        }
        authenticate_user_or_fail(email, plain_text_pwd, users, res);
    };

    // LOGOUT
    const logout = (req: Request, res: Response) => {
        res.clearCookie("token", {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
        });
        res.type("html").send(render_fragment("signout.html"));
    };

    const me = (req: Request, res: Response) => {
        if (req.cookies.token) {
            const token_done_func = (usr: ss_user | null, err: string | null) => {
                if (usr) {
                    res.type("html").send(
                        render_fragment("navbar-right-logged-in.html", {
                            first_name: usr.first_name,
                            icon_ver: req.app.locals.ICON_VER,
                        })
                    );
                    ilog(`User ${usr.first_name} ${usr.last_name} (${usr.email}) logged in`);
                } else {
                    res.type("html").send(
                        render_fragment("navbar-right-not-logged-in.html", { icon_ver: req.app.locals.ICON_VER })
                    );
                    ilog("User not logged in: ", err);
                }
            };
            get_user_from_token(req.cookies.token, token_done_func);
        } else {
            res.type("html").send(render_fragment("navbar-right-not-logged-in.html"));
        }
    };

    const auth_router = Router();
    auth_router.post("/api/login", login);
    auth_router.post("/api/logout", logout);
    auth_router.get("/api/me", me);

    return auth_router;
}
