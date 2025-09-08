import template from "../template.js";
import type { Response } from "express";

interface err_response {
  message: string;
}

export function send_status_error(
  status_code: number,
  err: Error | string,
  res: Response,
  html: boolean,
) {
  const errc: err_response = {
    message: typeof err === "string" ? err : err.message,
  };
  ilog(errc);
  return html
    ? res
        .status(status_code)
        .type("html")
        .send(template.render_fragment("errmsg.html", { msg: errc.message }))
    : res.status(status_code).json(errc);
}
