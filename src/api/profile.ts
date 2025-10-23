import { type Request, type Response, type NextFunction, Router } from "express";
import { MongoClient, Collection } from "mongodb";
import multer from "multer";
import sharp from "sharp";

import { render_fragment } from "../template.js";
import { verify_liuser } from "./auth.js";
import type { ss_user } from "./users.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
});

// This is the "middleware" muliter func - basically just processes multipart requests and puts the file result in the req.file
const multer_profile_func = upload.single('profile_pic');

type sanitize_pic_callback = (err: Error, buffer: Buffer, output_info: sharp.OutputInfo) => void;

function sanitize_pic(file_buffer: Buffer, done_cb:  sanitize_pic_callback) {
    const sharp_img = sharp(file_buffer).rotate().resize(512, 512, {fit: "cover"}).toFormat("webp", { quality: 80}).withMetadata({});
    sharp_img.toBuffer(done_cb);
}

// function verify_buffer_is_image(buf: Buffer): boolean {
//   // minimal magic-byte checks (JPEG/PNG/WebP). Add stricter checks as needed.
//   const is_jpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
//   const is_png  = buf.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]));
//   const is_riff = buf.slice(0,4).toString() === "RIFF" && buf.slice(8,12).toString() === "WEBP";
//   return is_jpeg || is_png || is_riff;
// }

export function create_profile_routes(mongo_client: MongoClient): Router {
    const db = mongo_client.db(process.env.DB_NAME);
    const coll_name = process.env.USER_COLLECTION_NAME!;
    const users = db.collection<ss_user>(coll_name);

    // Get edit profile page
    const edit_profile = (req: Request, res: Response) => {
        // desctructuring - pull username from body and store it as unsername_or_email, and pwd as plain_text_pwd
        const usr = req.liuser as ss_user;
        const html_txt = render_fragment("edit-profile.html", {
            profile_pic_url: usr.profile && usr.profile.pfp_url ? usr.profile.pfp_url : "profile_pics/default.png",
            public_name: usr.profile && usr.profile.public_name ? usr.profile.public_name : usr.first_name,
            profile_about: usr.profile && usr.profile.about,
        });
        const index_html = render_fragment("index.html", { main_content_html: html_txt });
        res.type("html").send(index_html);
    };

    // Upload profile pic
    const upload_pfp = (req: Request, res: Response) => {
        ilog("Got request");
        const usr = req.liuser as ss_user;

        const on_sanitize_complete = (err: Error, buffer: Buffer, output_info: sharp.OutputInfo) => {
            if (err) {
                
            }
            
        }
        res.type('html').send(`<div id="edit-profile-pic-errors" hx-swap-oob="true">Could not upload profile image</div>`);
    };

    const profile_router = Router();
    profile_router.get("/profile", verify_liuser, edit_profile);
    profile_router.post("/profile/pic", verify_liuser, multer_profile_func, upload_pfp);
    return profile_router;
}
