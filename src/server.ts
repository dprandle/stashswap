import express from "express";
import dotenv from "dotenv";
import cookie_parser from "cookie-parser";
import template from "./template.js";
import path from "path";
import { fileURLToPath } from "url";

import { get_local_ip } from "./util.js";
import { MongoClient } from "mongodb";

// Source map for tracing things back to typescript rather than generated javascript
// import "source-map-support/register";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pull our env vars
dotenv.config();

// Extend our request type to have any additional members we need and create some aliases for ilog guys
declare global {
  var ilog: any;
  var dlog: any;
  var wlog: any;
  var elog: any;
  var asrt: any;
}
globalThis.ilog = console.log;
globalThis.dlog = console.debug;
globalThis.wlog = console.warn;
globalThis.elog = console.error;
globalThis.asrt = console.assert;

// Create the mongodb client
const mdb_uri = process.env.MONGODB_URI!;
asrt(mdb_uri);

// Pull in our port
const port = process.env.PORT!;
asrt(port);

const mdb_client = new MongoClient(mdb_uri);

async function start_server() {
  await mdb_client.connect();
  ilog("Connected to db");
  const app = express();
  app.use(cookie_parser());

  // Set up a debug view of requests
  app.use(
    (
      req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => {
      dlog("Request URL:", req.url);
      next();
    },
  );

  app.use(express.json());

  app.use(express.static(path.join(__dirname, "../public")));

  // Send index.html for any route that has not been handled yet - express 5 requires the braces and the
  // word after the wildcard - before express 5 this would have have just been "*"
  app.get("/", function (_req, res) {
    res.type("html").send(template.render_fragment("index.html"));
  });

  app.get("/signin", function (_req, res) {
    res.type("html").send(template.render_fragment("signin.html"));
  });

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
