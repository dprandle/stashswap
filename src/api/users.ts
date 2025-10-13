import { type Request, type Response, Router } from "express";
import { MongoClient, ObjectId, Collection, type InsertOneResult } from "mongodb";
import bc from "bcrypt";
import { send_status_resp } from "./error.js";
import { authenticate_user_and_respond } from "./auth.js";

export interface bsyr_user {
    _id: ObjectId;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    pwd: string;
}

export interface bsyr_user_resp {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
}

// - At least one lowercase letter (=(?=.*[a-z])=)
// - At least one uppercase letter (=(?=.*[A-Z])=)
// - At least one digit (=(?=.*\d)=)
// - At least one special character (=(?=.*[@$!%*?&#])=)
// - Minimum length of 8 characters (={8,}=)
//const password_regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
const password_regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&])[A-Za-z\d!@#$%^&]{8,}$/;
const username_regex = /^(?=.{3,}$)(?!.*[_-]{2,})(?![_-])(?!.*[_-]$)[\w-]*$/;

interface error_info {
    code: number;
    message: string;
}

type create_user_callback = (new_user: bsyr_user | null, error: error_info | null) => void;

function hash_password_and_create_user(
    new_user: bsyr_user,
    users: Collection<bsyr_user>,
    done_callback: create_user_callback
) {
    // Set the new user's id
    new_user._id = new ObjectId();

    // Hash function callback
    const on_hash_complete = (err: any, hash: string) => {
        // If there was a hash error - that is a server problem
        if (err) {
            done_callback(null, { code: 500, message: err.toString() });
            return;
        }

        // We successfully hashed the password - set it in the bsyr user and then insert the user in our collection
        new_user.pwd = hash;

        // Resolve and reject promise callbacks
        const on_insert_resolved = (result: InsertOneResult<bsyr_user>) => {
            if (result.insertedId == new_user._id) {
                done_callback(new_user, null);
            } else {
                done_callback(null, { code: 500, message: "Unexpected id when creating user" });
            }
        };
        const on_insert_reject = (reason: any) => {
            done_callback(null, { code: 400, message: reason.toString() });
        };

        // Insert the user and pass the promise the resolve and reject callbacks
        const insert_prom = users.insertOne(new_user);
        insert_prom.then(on_insert_resolved, on_insert_reject);
    };

    // Hash the user providing callback from above
    bc.hash(new_user.pwd, 10, on_hash_complete);
}

function create_user(new_user: bsyr_user, users: Collection<bsyr_user>, done_callback: create_user_callback) {
    ilog("Got user creation request for ", new_user);
    if (!/\S+@\S+\.\S+/.test(new_user.email)) {
        done_callback(null, { code: 400, message: "Invalid email format" });
        return;
    }

    if (!password_regex.test(new_user.pwd)) {
        done_callback(null, { code: 400, message: `Password '${new_user.pwd}' does not meet guidelines` });
        return;
    }

    if (!username_regex.test(new_user.username)) {
        done_callback(null, { code: 400, message: "Username does not meet guidelines" });
        return;
    }

    // First, check if there is an existing user
    const exists_user_check_complete = (found_usr: bsyr_user | null) => {
        if (found_usr) {
            done_callback(null, { code: 400, message: "User already exists" });
        } else {
            hash_password_and_create_user(new_user, users, done_callback);
        }
    };
    const exists_user_check_rejected = (reason: any) => {
        done_callback(null, { code: 500, message: "Server request failed: " + reason });
    };

    const existing_usr_prom = users.findOne({ $or: [{ username: new_user.username }, { email: new_user.email }] });
    existing_usr_prom.then(exists_user_check_complete, exists_user_check_rejected);
}

export function create_user_routes(mongo_client: MongoClient): Router {
    const db = mongo_client.db(process.env.DB_NAME);
    const coll_name = process.env.USER_COLLECTION_NAME!;
    const users = db.collection<bsyr_user>(coll_name);

    function create_user_req(req: Request, res: Response) {
        const new_user: bsyr_user = { ...req.body, first_name: "", last_name: "" };

        const on_done_cb = (new_user: bsyr_user | null, error: error_info | null) => {
            if (new_user) {
                const html_resp = function () {
                    res.type("html").send("<h2>Success</h2>");
                };
                const json_resp = function () {
                    res.status(201).send(new_user);
                };
                res.format({
                    html: html_resp,
                    json: json_resp,
                });
            } else if (error) {
                send_status_resp(error.code, error.message, res);
            } else {
                send_status_resp(500, "Unknown error", res);
            }
        };
        create_user(new_user, users, on_done_cb);
    }

    // Get a specific user by id
    function create_user_and_login_req(req: Request, res: Response) {
        const new_user: bsyr_user = { ...req.body, first_name: "", last_name: "" };
        const on_done_cb = (new_user: bsyr_user | null, error: error_info | null) => {
            if (new_user) {
                authenticate_user_and_respond(new_user, "Created user and logged in", res);
            } else if (error) {
                send_status_resp(error.code, error.message, res);
            } else {
                send_status_resp(500, "Unknown error", res);
            }
        };
        create_user(new_user, users, on_done_cb);
    }

    const user_router = Router();
    user_router.post("/", create_user_req);
    user_router.post("/login", create_user_and_login_req);

    return user_router;
}
