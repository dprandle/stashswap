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

type liuser_token_callback = (user: liuser_payload | null, err: string | null) => void;

export interface liuser_payload {
    id: string;
};

function get_liuser_from_token(token: string, callback: liuser_token_callback) {
    // When verification completes we either return invalid creds
    const on_verify_function = (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {
        if (err) {
            callback(null, "Invalid credentials");
        }
        if (decoded) {
            callback(decoded as liuser_payload, null);
        }
    };
    jwt.verify(token, SECRET_JWT_KEY, on_verify_function);
}

export function send_unauthorized_response(res: Response) {
    const login_html = template.render_fragment("login.html", {hidden_class: "hidden"});
    const index_with_login = template.render_fragment("index.html", {sign_in_fragment: login_html});
    res.status(200).type("html").send(index_with_login);
}

// This can be used as "middleware" for protected routes. Just understand that failure returns a 401 response which, when using htmx,
// will return the errmsg fragment.
export function verify_liuser(req: Request, res: Response, next: NextFunction) {
    if (req.cookies.token) {
        const token_done_func = (usr_token: liuser_payload | null, err: string | null) => {
            if (usr_token) {
                req.liuser = usr_token;
                next();
            } else {
                ilog("Failed to verify user: ", err);
                send_unauthorized_response(res);
            }
        };
        get_liuser_from_token(req.cookies.token, token_done_func);
    } else {
        send_unauthorized_response(res);
    }
}

export function create_user_session(user: ss_user, res: Response, signed_token_callback: (token: string | null, err: string | null) => void) {
    const cb_func = (err: Error | null, token: string | undefined) => {
        if (token && !err) {
            res.cookie("token", token, {
                httpOnly: true,
                secure: false, // true if using https
                sameSite: "strict",
                maxAge: 60 * 60 * 1000, // 1 hour
            });
        }
        signed_token_callback(token ? token : null, err ? err.message : null);
    };
    const liuser = {id: user._id};
    jwt.sign(liuser, SECRET_JWT_KEY, { expiresIn: "1h" }, cb_func);
}

export function sign_in_user_send_resp(usr: ss_user, res: Response) {
    const on_token_signed = (token: string | null, err: string | null) => {
        if (token && !err) {
            ilog(`${usr.username} - ${usr.email} (${usr._id}) logged in successfully`);
            // On login, we want to show the user dashboard, and not a json message
            setTimeout(() => {
                res.type("html").send(
                    render_fragment("log-in-success.html", {
                        first_name: usr.first_name,
                    })
                );
            }, 1000);
        }
        else {
            wlog(`Error loging token for user ${usr.username} (${usr.email}): ${err}`);
            send_err_resp(200, "Failed to sign token", res);
        }
    }
    create_user_session(usr, res, on_token_signed);
}

export function sign_out_user_send_resp(res: Response) {
    res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
    });
    res.type("html").send(render_fragment("logout.html"));
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
                    sign_in_user_send_resp(result, res);
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
    const logout = (_req: Request, res: Response) => {
        sign_out_user_send_resp(res);
    };

    const me = (req: Request, res: Response) => {
        // Anything that goes wrong will send this
        const send_not_logged_in_resp = (err: any) => {
            res.type("html").send(
                render_fragment("navbar-right-not-logged-in.html", { icon_ver: req.app.locals.ICON_VER })
            );
            ilog("User not logged in: ", err);
        };

        // When everything goes right and we finally log in - this is what we send
        const send_logged_in_resp = (usr: ss_user) => {
            res.type("html").send(
                render_fragment("navbar-right-logged-in.html", {
                    first_name: usr.first_name,
                    icon_ver: req.app.locals.ICON_VER,
                })
            );
            ilog(`User ${usr.username} - ${usr.email} (${usr._id}) logged in`);
        };

        if (req.cookies.token) {
            const token_done_func = (usr_token: liuser_payload | null, err: string | null) => {
                if (usr_token) {
                    const find_prom = users.findOne({_id: usr_token.id});
                    
                    // If the request had no errors 
                    const on_find_user_resolved = (result: ss_user | null) => {
                        result ? send_logged_in_resp(result) : send_not_logged_in_resp(`${JSON.stringify(usr_token)} not found in users`);
                    };
                    
                    // If there were errors in the request
                    const on_find_user_rejected = (err: any) => {
                        send_not_logged_in_resp(err);
                    };
                    find_prom.then(on_find_user_resolved, on_find_user_rejected);
                } else {
                    send_not_logged_in_resp(err);
                }
            };
            get_liuser_from_token(req.cookies.token, token_done_func);
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
