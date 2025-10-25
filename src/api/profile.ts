import { type Request, type Response, type NextFunction, Router } from "express";
import { MongoClient, Collection, type UpdateResult } from "mongodb";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";

import { render_fragment } from "../template.js";
import { verify_liuser } from "./auth.js";
import type { ss_user, ss_user_profile } from "./users.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
});

// This is the "middleware" muliter func - basically just processes multipart requests and puts the file result in the req.file
const multer_profile_func = upload.single("profile_pic");

type sanitize_pic_callback = (err: Error, buffer: Buffer, output_info: sharp.OutputInfo) => void;

function sanitize_pic(file_buffer: Buffer, done_cb: sanitize_pic_callback) {
    const sharp_img = sharp(file_buffer)
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .toFormat("webp", { quality: 80 })
        .withMetadata({});
    sharp_img.toBuffer(done_cb);
}

// function verify_buffer_is_image(buf: Buffer): boolean {
//   // minimal magic-byte checks (JPEG/PNG/WebP). Add stricter checks as needed.
//   const is_jpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
//   const is_png  = buf.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]));
//   const is_riff = buf.slice(0,4).toString() === "RIFF" && buf.slice(8,12).toString() === "WEBP";
//   return is_jpeg || is_png || is_riff;
// }

function send_upload_pfp_response(res: Response, pfp_url: string, err_msg: string | null) {
    const main_img = `<img src="${pfp_url}">`;
    const errs = `<div id="edit_profile_pic_errs" hx-swap-oob="innerHTML">${err_msg ? err_msg : ""}</div>`;
    res.type("html").send(main_img + "\n" + errs);
}

function send_update_profile_response(res: Response, err_msg: string | null) {
    const html = `<div id="${err_msg ? "edit_profile_update_errs" : "edit_profile_save_success_ind"}" hx-swap-oob="innerHTML">${err_msg ? err_msg : "Saved"}</div>`;
    dlog("Sending response", html);
    res.type("html").send(html);
}

export function create_profile_routes(mongo_client: MongoClient): Router {
    const db = mongo_client.db(process.env.DB_NAME);
    const coll_name = process.env.USER_COLLECTION_NAME!;
    const users = db.collection<ss_user>(coll_name);

    // Get edit profile page
    const edit_profile = (req: Request, res: Response) => {
        // desctructuring - pull username from body and store it as unsername_or_email, and pwd as plain_text_pwd
        const usr = req.liuser as ss_user;
        const html_txt = render_fragment("edit-profile.html", {
            pfp_url: usr.profile && usr.profile.pfp_url ? usr.profile.pfp_url : "profile_pics/default.png",
            public_name: usr.profile && usr.profile.public_name ? usr.profile.public_name : usr.first_name,
            profile_about: usr.profile && usr.profile.about,
        });
        const index_html = render_fragment("index.html", { main_content_html: html_txt });
        res.type("html").send(index_html);
    };

    // Upload profile pic
    const upload_pfp = (req: Request, res: Response) => {
        const usr = req.liuser as ss_user;
        const default_pfp = "profile_pics/default.png";
        if (!req.file || !req.file.buffer) {
            send_upload_pfp_response(res, default_pfp, "No file uploaded");
            return;
        }
        const on_sanitize_complete = (err: Error, buffer: Buffer, _output_info: sharp.OutputInfo) => {
            if (err) {
                send_upload_pfp_response(res, default_pfp, err.message);
            } else {
                const pfp_url = `profile_pics/${usr._id.toString()}.webp`;
                const update_op = { $set: { "profile.pfp_url": pfp_url } };
                const dbop_prom = users.updateOne({ _id: usr._id }, update_op);

                const on_update_resolved = (result: UpdateResult<ss_user>) => {
                    if (result.acknowledged && result.matchedCount == 1) {
                        const on_file_write_done = (err: NodeJS.ErrnoException | null) => {
                            if (err) {
                                wlog("File write error: ", err.message);
                                send_upload_pfp_response(res, default_pfp, "Error:" + err.message);
                            } else {
                                ilog("Updated profile pic for user ", usr._id);
                                send_upload_pfp_response(res, pfp_url, null);
                            }
                        };
                        ilog("Saving profile pic for user ", usr._id, " to ", `public/${pfp_url}`);
                        fs.writeFile(`public/${pfp_url}`, buffer, on_file_write_done);
                    } else if (result.acknowledged) {
                        wlog("Server error - could not match ", usr._id, " in users to update profile pic");
                        send_upload_pfp_response(res, default_pfp, "Server error - logged in user not matched");
                    }
                };

                const on_update_rejected = (err: any) => {
                    wlog("Update error: ", err.message);
                    send_upload_pfp_response(res, default_pfp, "Could not update profile pic: " + err.message);
                };

                dbop_prom.then(on_update_resolved, on_update_rejected);
            }
        };
        sanitize_pic(req.file.buffer, on_sanitize_complete);
    };

    const update_profile = (req: Request, res: Response) => {
        const usr = req.liuser as ss_user;
        const public_name = req.body.public_name;
        const about = req.body.about;
        const update_op = {
            $set: {
                "profile.public_name": public_name,
                "profile.about": about,
            },
        };
        const on_update_resolved = (result: UpdateResult<ss_user>) => {
            if (result.acknowledged && result.matchedCount == 1) {
                ilog(
                    `Updated profile.public_name from ${usr.profile.public_name} to ${public_name} and about from ${usr.profile.about} to ${about} for user ${usr._id}`
                );
                send_update_profile_response(res, null);
            } else if (result.acknowledged) {
                wlog("Server error - could not match", usr._id, " in users to update profile");
                send_update_profile_response(res, "Server error - logged in user not matched");
            }
        };
        const on_update_rejected = (err: any) => {
            wlog("Update error:", err.message);
            send_update_profile_response(res, "There was a problem with the update: " + err.message);
        };
        const update_prom = users.updateOne({ _id: usr._id }, update_op);
        update_prom.then(on_update_resolved, on_update_rejected);
    };

    const profile_router = Router();
    profile_router.get("/profile", verify_liuser, edit_profile);
    profile_router.post("/profile", verify_liuser, update_profile);
    profile_router.post("/profile/pic", verify_liuser, multer_profile_func, upload_pfp);
    return profile_router;
}
