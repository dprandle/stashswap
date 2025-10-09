import { type Request, type Response, type NextFunction, Router } from 'express';
import { MongoClient, Collection } from 'mongodb';
import bc from 'bcrypt';
import jwt from 'jsonwebtoken';

import { render_fragment } from '../template.js';
import { send_status_error } from './error.js';
import type { bsyr_user, bsyr_user_resp } from './users.js';

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY!;
asrt(SECRET_JWT_KEY);

declare global {
    namespace Express {
        interface Request {
            liuser?: jwt.JwtPayload | string | undefined;
        }
    }
}

type user_callback = (user: bsyr_user_resp | null, err: string | null) => void;

function get_user_from_token(token: string, callback: user_callback) {
    // When verification completes we either return invalid creds
    const on_verify_function = (err: jwt.VerifyErrors | null, decoded: jwt.JwtPayload | string | undefined) => {
        if (err) {
            callback(null, 'Invalid credentials');
        }
        if (decoded) {
            callback(decoded as bsyr_user_resp, null);
        }
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
    const token = jwt.sign(payload, SECRET_JWT_KEY, { expiresIn: '1h' });

    if (html_resp) {
        res.cookie('token', token, {
            httpOnly: true,
            secure: false, // true if using https
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000, // 1 hour
        });
        // On login, we want to show the user dashboard, and not a json message
        setTimeout(() => {
            res.type('html').send(
                render_fragment('log-in-success.html', {
                    first_name: user.first_name,
                })
            );
        }, 3000);
    } else {
        res.json({ message: message, user: payload, token: token });
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
                    authenticate_user_and_respond(result, 'Login successful', res, use_html);
                } else {
                    send_status_error(200, 'Incorrect password', res, use_html);
                }
            };
            const on_hash_comp_rejected = (reason: any) => {
                send_status_error(500, reason, res, use_html);
            };
            const hash_comp_prom = bc.compare(plaint_text_pwd, result.pwd);
            hash_comp_prom.then(on_hash_comp_resolved, on_hash_comp_rejected);
        } else {
            send_status_error(200, 'User not found', res, use_html);
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
            res.set('Vary', 'Accept');
        }

        // We require both of these to attempt login
        if (!email || !plain_text_pwd) {
            send_status_error(200, 'Username and password are required', res, use_html);
            return;
        }

        // The final result of this function is to send a response to the client
        authenticate_user_or_fail(email, plain_text_pwd, users, res, use_html);
    };

    // LOGOUT
    const logout = (req: Request, res: Response) => {
        const use_html: boolean = req.accepts('html') === 'html';
        if (use_html) {
            res.set('Vary', 'Accept');
        }

        if (use_html) {
            res.clearCookie('token', {
                httpOnly: true,
                secure: false,
                sameSite: 'strict',
            });
            res.type('html').send(render_fragment('signout.html'));
        } else {
            res.json({ message: 'Logged out!' });
        }
    };

    const me = (req: Request, res: Response) => {
        const use_html: boolean = req.accepts('html') === 'html';
        if (use_html) {
            res.set('Vary', 'Accept');
        }

        // This is to later have the token from any mobile device token
        let token: string = '';
        if (use_html) {
            token = req.cookies.token ? req.cookies.token : '';
        }
        
        if (token) {
            const token_done_func = (usr: bsyr_user_resp | null, err: string | null) => {
                if (usr) {
                    res.type('html').send(
                        render_fragment('navbar-right-logged-in.html', {
                            first_name: usr.first_name,
                            icon_ver: req.app.locals.ICON_VER,
                        })
                    );
                    ilog(`User ${usr.first_name} ${usr.last_name} (${usr.email}) logged in`);
                } else {
                    res.type('html').send(render_fragment('navbar-right-not-logged-in.html', {icon_ver: req.app.locals.ICON_VER}));
                    ilog('User not logged in: ', err);
                }
            };
            get_user_from_token(token, token_done_func);
        } else {
            res.type('html').send(render_fragment('navbar-right-not-logged-in.html'));
        }
    };

    const auth_router = Router();
    auth_router.post('/login', login);
    auth_router.post('/logout', logout);
    auth_router.get('/me', me);

    return auth_router;
}
