const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const port = Number(process.env.WEBXR_HTTPS_PORT || 8443);
const password = process.env.WEBXR_HTTPS_CERT_PASSWORD || "webxr-local";
const serverDir = path.resolve(__dirname);
const rootDir = path.resolve(serverDir, "..");
const pfxPath = path.join(serverDir, "local-dev-cert.pfx");

const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".html": "text/html; charset=utf-8",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".mp3": "audio/mpeg",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
	".wasm": "application/wasm",
	".webp": "image/webp"
};

const getLanAddresses = function() {
	const interfaces = os.networkInterfaces();
	const addresses = [];
	Object.keys(interfaces).forEach(function(name) {
		(interfaces[name] || []).forEach(function(entry) {
			if (!entry || entry.internal || entry.family !== "IPv4") {
				return;
			}
			if (addresses.indexOf(entry.address) === -1) {
				addresses.push(entry.address);
			}
		});
	});
	return addresses;
};

const sendResponse = function(response, statusCode, body, contentType) {
	response.writeHead(statusCode, {
		"Content-Type": contentType || "text/plain; charset=utf-8",
		"Cache-Control": "no-store"
	});
	response.end(body);
};

const getSafeFilePath = function(requestUrl) {
	let pathname = "/";
	try {
		pathname = new URL(requestUrl, "https://localhost/").pathname || "/";
	} catch (error) {
		pathname = "/";
	}
	pathname = decodeURIComponent(pathname);
	if (pathname.endsWith("/")) {
		pathname += "index.html";
	}
	const resolvedPath = path.resolve(rootDir, "." + pathname);
	return resolvedPath.startsWith(rootDir) ? resolvedPath : "";
};

if (!fs.existsSync(pfxPath)) {
	console.error("Missing certificate file:", pfxPath);
	console.error("Run start-local-https-server.bat to generate it first.");
	process.exit(1);
}

const server = https.createServer({
	pfx: fs.readFileSync(pfxPath),
	passphrase: password
}, function(request, response) {
	const filePath = getSafeFilePath(request.url || "/");
	if (!filePath) {
		sendResponse(response, 403, "Forbidden");
		return;
	}
	fs.readFile(filePath, function(error, data) {
		if (error) {
			sendResponse(response, error.code === "ENOENT" ? 404 : 500, error.code === "ENOENT" ? "Not found" : "Internal server error");
			return;
		}
		const extension = path.extname(filePath).toLowerCase();
		sendResponse(response, 200, data, mimeTypes[extension] || "application/octet-stream");
	});
});

server.listen(port, "0.0.0.0", function() {
	const lanAddresses = getLanAddresses();
	console.log("");
	console.log("Local HTTPS server running");
	console.log("Project root:", rootDir);
	console.log("Port:", port);
	console.log("");
	console.log("Open on this PC:");
	console.log("  https://localhost:" + port + "/");
	console.log("");
	if (lanAddresses.length) {
		console.log("Open from Quest on the same network:");
		lanAddresses.forEach(function(address) {
			console.log("  https://" + address + ":" + port + "/");
		});
	} else {
		console.log("No external IPv4 address detected.");
	}
	console.log("");
	console.log("If Quest shows a certificate warning, continue manually once.");
});
