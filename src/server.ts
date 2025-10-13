import "./bootstrap.js";
import express from "express";
import cookie_parser from "cookie-parser";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

import template from "./template.js";
import { create_auth_routes } from "./api/auth.js";
import { create_account_routes } from "./api/account.js";
import { get_local_ip } from "./util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the mongodb client
const mdb_uri = process.env.MONGODB_URI!;
asrt(mdb_uri);

// Pull in our port
const port = process.env.PORT!;
asrt(port);

const manifest = JSON.parse(readFileSync("public/asset-manifest.json", "utf8"));
const ICON_VER = manifest["icons.svg"]; // e.g. "a1b2c3d4"

// helper if you want it everywhere

const mdb_client = new MongoClient(mdb_uri);

function deb_req_func(req: express.Request, _res: express.Response, next: express.NextFunction) {
    dlog("Request URL:", req.url);
    next();
}

async function start_server() {
    await mdb_client.connect();
    ilog("Connected to db");
    const app = express();

    // Hash icon file
    app.locals.ICON_VER = ICON_VER;

    // Set up a debug view of requests
    app.use(deb_req_func);

    // Handle cookies
    app.use(cookie_parser());

    // Parse json
    app.use(express.json());

    // Parse forms and such
    app.use(bodyParser.urlencoded({ extended: true }));

    // Serve assets
    app.use(express.static(path.join(__dirname, "../public")));

    // Send index.html
    app.get("/", function (_req, res) {
        res.type("html").send(template.render_fragment("index.html"));
    });

    // Send signin
    app.get("/signin", function (_req, res) {
        res.type("html").send(template.render_fragment("signin.html"));
    });
    
    app.get("/orders", function (_req, res) {
        res.type("html").send(template.render_fragment("orders.html"));
    });
    
    app.get("/messages", function (_req, res) {
        res.type("html").send(template.render_fragment("messages.html"));
    });

    app.get("/account-settings", function (_req, res) {
        res.type("html").send(template.render_fragment("account-settings.html"));
    });

    app.use("/", create_account_routes(mdb_client));

    // Auth routes
    app.use("/", create_auth_routes(mdb_client));

    // Handle 404s
    app.listen(port, (err?: Error) => {
        if (err) {
            elog("Server failed to start:", err);
            return;
        }

        const local_ip = get_local_ip();
        ilog(`Server listening at:`);
        ilog(`- Local:   http://localhost:${port}`);
        ilog(`- Network: http://${local_ip}:${port}`);
    });
}

start_server();
