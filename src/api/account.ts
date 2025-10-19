import { type Request, type Response, type NextFunction, Router } from "express";
import { MongoClient, Collection } from "mongodb";

import { render_fragment } from "../template.js";
import { verify_liuser } from "./auth.js";
import type { bsyr_user, bsyr_user_resp } from "./users.js";

export function create_account_routes(mongo_client: MongoClient): Router {
    const db = mongo_client.db(process.env.DB_NAME);
    const coll_name = process.env.USER_COLLECTION_NAME!;
    const users = db.collection<bsyr_user>(coll_name);

    // Get edit profile page
    const get_edit_profile = (req: Request, res: Response) => {
        // desctructuring - pull username from body and store it as unsername_or_email, and pwd as plain_text_pwd
        const usr = req.liuser as bsyr_user_resp;

        const html_resp = function () {
            const html_txt = render_fragment("edit-profile.html", {
                profile_pic_url: "profile_pics/default.png",
                public_name: usr.first_name + " " + usr.last_name,
                profile_about: "This is a scooby sandwich",
            });
            const index_html = render_fragment("index.html", {main_content_html: html_txt});
            res.type("html").send(index_html);
        };

        const json_resp = function () {
            res.json({ user: usr });
        };

        res.format({
            html: html_resp,
            json: json_resp,
        });
    };

    const account_router = Router();
    account_router.get("/profile", verify_liuser, get_edit_profile);
    return account_router;
}
