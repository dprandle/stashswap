import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";

export function get_local_ip() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      // Skip over internal (i.e., 127.0.0.1) and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

// Convert the current module URL to a file path
export function get_current_filename() {
  return fileURLToPath(import.meta.url);
}

export function get_current_dirname() {
  return dirname(get_current_filename());
}
