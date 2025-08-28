import { Response } from "express";

interface err_response {
  message: string;
}

export function send_status_error(status_code: number, err: Error | string, res: Response) {
  const errc: err_response = { message: typeof err === "string" ? err : err.message };
  ilog(errc);
  res.status(status_code).json(errc);
}
