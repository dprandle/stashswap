import template from "../template.js";
import type { Response } from "express";

interface err_response {
    message: string;
}

export function send_status_resp(status_code: number, err: Error | string, res: Response) {
    const errc: err_response = {
        message: typeof err === "string" ? err : err.message,
    };
    ilog(errc);

    const html_resp = function () {
        res.status(status_code)
            .type("html")
            .send(template.render_fragment("errmsg.html", { msg: errc.message }));
    };

    const json_resp = function () {
        res.status(status_code).json(errc);
    };

    res.format({ html: html_resp, json: json_resp });
}
