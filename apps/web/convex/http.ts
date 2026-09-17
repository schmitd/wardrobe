import { httpRouter } from "convex/server";
import { upload, uploadOptions } from "../confect/uploadHttp";
import { UPLOAD_PATH } from "../confect/uploadPolicy";

const http = httpRouter();
http.route({ path: UPLOAD_PATH, method: "POST", handler: upload });
http.route({ path: UPLOAD_PATH, method: "OPTIONS", handler: uploadOptions });

export default http;
