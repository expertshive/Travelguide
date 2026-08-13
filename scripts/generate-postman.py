#!/usr/bin/env python3
"""Build the Postman collection from the services' own OpenAPI documents.

Every NestJS service publishes its routes at `/docs-json`, so the collection is
generated from those documents rather than maintained by hand — a route, DTO
field or query parameter that changes in code cannot silently drift out of the
collection.

Usage:
    python3 scripts/generate-postman.py            # read specs from running services
    python3 scripts/generate-postman.py --offline   # reuse previously saved specs

Output (written to `postman/`):
    Traveler-Guide.postman_collection.json
    Traveler-Guide.Local.postman_environment.json
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "postman"
SPEC_CACHE = OUT_DIR / ".specs"

COLLECTION_NAME = "Traveler Guide API"
SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"

# Service name -> (port, gateway segment, display label). The segment is the
# first path element after /v1 and is what the gateway routes on.
SERVICES: list[tuple[str, int, str | None, str]] = [
    ("api-gateway", 4000, None, "API Gateway"),
    ("auth-service", 4001, "auth", "Auth"),
    ("user-service", 4002, "users", "Users"),
    ("trip-service", 4003, "trips", "Trips"),
    ("place-service", 4004, "places", "Places"),
    ("navigation-service", 4005, "navigation", "Navigation"),
    ("social-service", 4006, "social", "Social"),
    ("chat-service", 4007, "chat", "Chat"),
    ("notification-service", 4008, "notifications", "Notifications"),
    ("media-service", 4009, "media", "Media"),
    ("ai-service", 4010, "ai", "AI"),
    ("payment-service", 4011, "payments", "Payments"),
    ("business-service", 4012, "business", "Business"),
    ("map-service", 4013, "map", "Map"),
]

# Reachable without a token. The gateway keeps this list too; anything absent
# from it is rejected before it reaches a service.
PUBLIC_PATHS = {
    "/v1/auth/register/send-otp",
    "/v1/auth/register/verify-otp",
    "/v1/auth/login",
    "/v1/auth/refresh",
    "/v1/auth/forgot-password",
    "/v1/auth/reset-password",
}

# Folder layout. Numeric prefixes keep a sensible order in the Postman sidebar
# and make the collection runnable top to bottom.
F_HEALTH = "01 · Health & Discovery"
F_AUTH_PUBLIC = "02 · Auth · Public"
F_AUTH_SESSION = "03 · Auth · Session"
F_USERS = "04 · Users (admin)"
F_ROLES = "05 · Roles & Permissions (admin)"
F_INTEGRATIONS = "06 · Integrations (admin)"
F_PROFILES = "07 · User Profiles"
F_GEOCODE = "08 · Map · Geocoding"
F_ROUTES = "09 · Map · Routes"
F_AI = "10 · AI Assistant"
F_DB = "11 · Database Admin"
F_INTERNAL = "12 · Internal (service-to-service)"

# (service, openapi tag) -> folder. DB Admin is handled separately because it
# gets one subfolder per service.
FOLDER_MAP: dict[tuple[str, str], str] = {
    ("api-gateway", "Health"): F_HEALTH,
    ("api-gateway", "Admin"): F_HEALTH,
    ("auth-service", "Auth"): F_AUTH_SESSION,  # public ones are moved below
    ("auth-service", "Users"): F_USERS,
    ("auth-service", "Roles"): F_ROLES,
    ("auth-service", "Integrations"): F_INTEGRATIONS,
    ("user-service", "Profile"): F_PROFILES,
    ("map-service", "geocode"): F_GEOCODE,
    ("map-service", "routes"): F_ROUTES,
    ("ai-service", "assistant"): F_AI,
}

FOLDER_DESCRIPTIONS = {
    F_HEALTH: (
        "Liveness checks and service discovery.\n\n"
        "`GET /v1/health` on the gateway reports only the gateway. The "
        "**Direct service health** requests bypass the gateway and hit each "
        "service on its own port, which is how you tell a dead service apart "
        "from a dead gateway.\n\n"
        "`GET /v1/admin/services` is what the admin portal calls to build its "
        "sidebar: it returns every service with its tables and an `online` flag."
    ),
    F_AUTH_PUBLIC: (
        "The only endpoints reachable without a token — the gateway keeps this "
        "exact list and rejects everything else before forwarding.\n\n"
        "**Start here.** `Login (admin)` and `Login (traveler)` both save "
        "`accessToken` and `refreshToken` into collection variables "
        "automatically, so every other request in this collection works "
        "afterwards without copying a token by hand."
    ),
    F_AUTH_SESSION: "Endpoints for the signed-in session. Requires a bearer token.",
    F_USERS: (
        "User administration. Requires the `admin:access` permission — sign in "
        "with the admin account first, or the gateway answers 403."
    ),
    F_ROLES: (
        "Role and permission management (RBAC). Requires `admin:access`.\n\n"
        "The `super_admin` role is protected and cannot be deleted."
    ),
    F_INTEGRATIONS: (
        "Third-party credential registry. Requires `admin:access`.\n\n"
        "Secrets are stored encrypted (AES-256-GCM) and are never returned in "
        "clear text — responses contain masked previews only. Saving a "
        "credential takes effect in the consuming service within ~30 seconds "
        "without a restart. Sending an empty string for a field clears it and "
        "falls back to the environment variable.\n\n"
        "`POST .../test` runs a live call against the provider and reports "
        "whether the credentials actually work."
    ),
    F_PROFILES: (
        "Traveler profile, avatar, gallery photos and social links. Any "
        "authenticated user may call these for their own profile.\n\n"
        "Avatar and photo uploads are `multipart/form-data` with a file field "
        "named `file` — select a local image in the request body tab before "
        "sending."
    ),
    F_GEOCODE: (
        "Place search, reverse geocoding, saved places (Home/Work/Custom) and "
        "recent searches.\n\n"
        "Results are served by a provider chain (Mapbox or Google, then an "
        "offline fallback) and cached in Redis, so a repeated search may be "
        "answered without calling the provider."
    ),
    F_ROUTES: (
        "Route calculation, alternatives, rerouting and stop-impact estimation.\n\n"
        "All coordinates are decimal degrees. The examples use Riyadh "
        "(24.7136, 46.6753). `mode` accepts `driving`, `motorcycle`, `walking` "
        "or `cycling`."
    ),
    F_AI: (
        "Conversational travel assistant (Google Gemini) and speech synthesis "
        "(ElevenLabs, with a device-voice fallback on the client).\n\n"
        "These are declared public inside ai-service, but the gateway still "
        "requires a bearer token because they are not on its public path list."
    ),
    F_DB: (
        "Schema-driven table browser and editor, mounted by every service at "
        "`/v1/{segment}/admin/db`. Requires the `admin:access` permission.\n\n"
        "The routes are generated from each service's Prisma schema, so the "
        "shape is identical everywhere and only the `:model` path parameter "
        "changes. Each subfolder below is pre-filled with a real model from "
        "that service.\n\n"
        "Notes:\n"
        "- Fields whose name looks sensitive (password, token, secret, otp, "
        "api key) are masked as `••••••` and cannot be edited.\n"
        "- `PATCH` and `DELETE` identify the row by primary key in `where`.\n"
        "- auth-service refuses to delete your own user row or the "
        "`super_admin` role."
    ),
    F_INTERNAL: (
        "Service-to-service endpoints. **The gateway deliberately returns 404 "
        "for these**, because they hand back credentials in clear text — they "
        "are reachable only on the internal network.\n\n"
        "The request below therefore targets auth-service directly on "
        "`{{authUrl}}` and authenticates with the `x-internal-token` shared "
        "secret rather than a JWT. This is the mechanism other services use to "
        "resolve API keys at runtime.\n\n"
        "It is excluded from Swagger on purpose, so it is written by hand here."
    ),
}

# Example row data per service so the Database Admin requests work as sent.
# Key is the gateway segment; value is (model, create payload).
DB_EXAMPLES: dict[str, tuple[str, dict[str, Any]]] = {
    "auth": ("role", {"name": "demo_role", "description": "Created from Postman"}),
    "users": ("serviceRecord", {"key": "demo-key", "value": "demo value"}),
    "map": (
        "savedPlace",
        {
            "userId": "{{userId}}",
            "label": "CUSTOM",
            "name": "Kingdom Centre",
            "address": "Al Olaya, Riyadh",
            "latitude": 24.7114,
            "longitude": 46.6745,
        },
    ),
}
DB_DEFAULT = ("serviceRecord", {"key": "demo-key", "value": "demo value"})

# Bodies the OpenAPI document types only as a free-form object.
FREEFORM: dict[tuple[str, str], Any] = {
    ("UpdateIntegrationDto", "values"): {"GOOGLE_MAPS_API_KEY": "AIzaSy…replace-me"},
    ("AssistantRequestDto", "context"): {
        "origin": "Riyadh",
        "destination": "AlUla",
        "mode": "driving",
        "stops": [],
    },
    ("AssistantRequestDto", "history"): [
        {"role": "user", "text": "Plan a trip to AlUla"},
        {"role": "assistant", "text": "How many days do you have?"},
    ],
}

# Path parameter -> collection variable, so ids are set once in one place.
PARAM_VARS = {
    "id": "{{resourceId}}",
    "userId": "{{userId}}",
    "roleName": "{{roleName}}",
    "photoId": "{{photoId}}",
    "platform": "{{platform}}",
    "provider": "{{provider}}",
}

# Endpoints that really take multipart uploads. NestJS cannot describe the file
# field in the OpenAPI document, so the form is declared here.
MULTIPART: dict[str, list[dict[str, str]]] = {
    "POST /v1/users/profile/avatar": [{"key": "file", "type": "file"}],
    "POST /v1/users/profile/photos": [
        {"key": "file", "type": "file"},
        {"key": "caption", "value": "Sunset in AlUla", "type": "text"},
    ],
}

SAVE_TOKENS = """// Store the tokens so every other request in this collection can use them.
const body = pm.response.json();
const data = body && body.data;

pm.test('login succeeded', function () {
  pm.expect(pm.response.code).to.be.oneOf([200, 201]);
  pm.expect(data && data.accessToken, 'accessToken in response').to.be.a('string');
});

if (data && data.accessToken) {
  pm.collectionVariables.set('accessToken', data.accessToken);
  pm.collectionVariables.set('refreshToken', data.refreshToken || '');
  console.log('Saved accessToken (' + data.accessToken.length + ' chars)');
}
"""


# --------------------------------------------------------------------------- #
# Spec loading
# --------------------------------------------------------------------------- #

def fetch_specs(offline: bool) -> dict[str, dict]:
    SPEC_CACHE.mkdir(parents=True, exist_ok=True)
    specs: dict[str, dict] = {}
    missing: list[str] = []

    for name, port, _segment, _label in SERVICES:
        cached = SPEC_CACHE / f"{name}.json"
        if not offline:
            try:
                url = f"http://localhost:{port}/docs-json"
                with urllib.request.urlopen(url, timeout=10) as response:
                    spec = json.load(response)
                cached.write_text(json.dumps(spec, indent=1))
                specs[name] = spec
                continue
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
                pass  # fall through to the cached copy
        if cached.exists():
            specs[name] = json.loads(cached.read_text())
        else:
            missing.append(f"{name} (:{port})")

    if missing:
        print("Could not read a spec for: " + ", ".join(missing), file=sys.stderr)
        print("Start the stack (pnpm dev:all) or pass --offline once a cache exists.",
              file=sys.stderr)
        if not specs:
            sys.exit(1)
    return specs


# --------------------------------------------------------------------------- #
# Example construction from JSON Schema
# --------------------------------------------------------------------------- #

def resolve(schema: dict, spec: dict, seen: frozenset[str] = frozenset()) -> dict:
    """Follow a local $ref, guarding against a schema that references itself."""
    ref = schema.get("$ref")
    if not ref:
        return schema
    name = ref.rsplit("/", 1)[-1]
    if name in seen:
        return {"type": "object"}
    target = spec.get("components", {}).get("schemas", {}).get(name, {})
    return resolve(target, spec, seen | {name}) if "$ref" in target else target


def schema_name(schema: dict) -> str | None:
    ref = schema.get("$ref")
    return ref.rsplit("/", 1)[-1] if ref else None


def example_for(
    schema: dict,
    spec: dict,
    owner: str | None = None,
    prop: str | None = None,
    depth: int = 0,
) -> Any:
    """Best example the schema can justify, preferring what the DTO declares."""
    if owner and prop and (owner, prop) in FREEFORM:
        return FREEFORM[(owner, prop)]

    name = schema_name(schema)
    schema = resolve(schema, spec)

    # `allOf` is how Nest expresses "this $ref, plus a description".
    if "allOf" in schema:
        merged: dict[str, Any] = {}
        for part in schema["allOf"]:
            resolved = resolve(part, spec)
            if resolved.get("properties"):
                merged.setdefault("type", "object")
                merged.setdefault("properties", {}).update(resolved["properties"])
                merged.setdefault("required", []).extend(resolved.get("required", []))
            else:
                merged.update({k: v for k, v in resolved.items() if k != "allOf"})
            name = name or schema_name(part)
        schema = merged or schema

    if "example" in schema:
        return schema["example"]
    if "default" in schema:
        return schema["default"]
    if schema.get("enum"):
        return schema["enum"][0]

    kind = schema.get("type")

    if kind == "object" or "properties" in schema:
        properties = schema.get("properties")
        if not properties:
            return {}
        if depth > 3:
            return {}
        return {
            key: example_for(value, spec, name or owner, key, depth + 1)
            for key, value in properties.items()
        }

    if kind == "array":
        item = example_for(schema.get("items", {}), spec, name or owner, prop, depth + 1)
        return [item] if item not in ({}, None) else []

    if kind == "boolean":
        return False
    if kind in ("number", "integer"):
        return 0
    if kind == "string":
        return f"<{prop}>" if prop else "<string>"
    return None


def body_example(operation: dict, spec: dict, method: str, path: str) -> Any | None:
    content = (operation.get("requestBody") or {}).get("content", {})
    schema = (content.get("application/json") or {}).get("schema")
    if not schema:
        return None

    payload = example_for(schema, spec)
    name = schema_name(schema)

    # Row editors describe `where`/`data` only as objects; fill them with the
    # concrete model this folder is pointed at.
    if name in ("CreateRowDto", "UpdateRowDto", "DeleteRowDto"):
        segment = path.split("/")[2] if len(path.split("/")) > 2 else ""
        _model, data = DB_EXAMPLES.get(segment, DB_DEFAULT)
        if name == "CreateRowDto":
            payload = {"data": data}
        elif name == "UpdateRowDto":
            first = next(iter(data), None)
            payload = {"where": {"id": "{{rowId}}"},
                       "data": {first: data[first]} if first else {}}
        else:
            payload = {"where": {"id": "{{rowId}}"}}

    # Credentials are per provider, so key the example off the default provider.
    if name == "UpdateIntegrationDto":
        payload = {"values": {"GOOGLE_MAPS_API_KEY": "AIzaSy…replace-me"}}

    if isinstance(payload, dict):
        if "email" in payload and "password" in payload:
            payload["email"] = "{{travelerEmail}}"
            payload["password"] = "{{travelerPassword}}"
        elif "email" in payload:
            payload["email"] = "{{travelerEmail}}"
        if "refreshToken" in payload:
            payload["refreshToken"] = "{{refreshToken}}"
        if payload.get("password") == "<password>":
            payload["password"] = "{{travelerPassword}}"
        if payload.get("token") == "<token>":
            payload["token"] = "{{resetToken}}"

    return payload


# --------------------------------------------------------------------------- #
# Postman item construction
# --------------------------------------------------------------------------- #

def url_for(path: str, params: list[dict], base: str = "{{baseUrl}}") -> dict:
    segments = [s for s in path.strip("/").split("/") if s]
    postman_path: list[str] = []
    variables: list[dict] = []

    for segment in segments:
        if segment.startswith("{") and segment.endswith("}"):
            key = segment[1:-1]
            postman_path.append(f":{key}")
            variables.append({"key": key, "value": PARAM_VARS.get(key, f"{{{{{key}}}}}")})
        else:
            postman_path.append(segment)

    url: dict[str, Any] = {
        "raw": f"{base}/{'/'.join(postman_path)}",
        "host": [base],
        "path": postman_path,
    }
    if variables:
        url["variable"] = variables

    query = []
    for param in params:
        if param.get("in") != "query":
            continue
        schema = param.get("schema", {})
        value = schema.get("example", schema.get("default"))
        if value is None:
            value = "" if schema.get("type") == "string" else ""
        entry = {
            "key": param["name"],
            "value": str(value),
            "description": param.get("description", ""),
        }
        # Optional parameters ship disabled so the request works as sent while
        # still documenting what can be tuned.
        if not param.get("required"):
            entry["disabled"] = True
        query.append(entry)
    if query:
        url["query"] = query
        url["raw"] = url["raw"] + "?" + "&".join(
            f"{q['key']}={q['value']}" for q in query if not q.get("disabled")
        )

    return url


def describe(operation: dict, path: str, method: str, public: bool, admin: bool) -> str:
    lines = []
    if operation.get("summary"):
        lines.append(operation["summary"])
    if operation.get("description"):
        lines.append(operation["description"])

    lines.append("")
    lines.append(f"`{method.upper()} {path}`")
    lines.append("")
    if public:
        lines.append("**Auth:** none — reachable without a token.")
    elif admin:
        lines.append("**Auth:** bearer token **plus the `admin:access` permission**. "
                     "Sign in with the admin account or the gateway answers 403.")
    else:
        lines.append("**Auth:** bearer token (inherited from the collection).")

    params = [p for p in operation.get("parameters", []) if p.get("in") == "query"]
    if params:
        lines.append("")
        lines.append("**Query parameters**")
        for param in params:
            flag = "required" if param.get("required") else "optional"
            note = f" — {param['description']}" if param.get("description") else ""
            lines.append(f"- `{param['name']}` ({flag}){note}")

    return "\n".join(lines)


def make_item(
    name: str,
    method: str,
    path: str,
    operation: dict,
    spec: dict,
    base: str = "{{baseUrl}}",
) -> dict:
    public = path in PUBLIC_PATHS or path == "/v1/health"
    admin = "/admin/" in path or path.endswith("/admin")

    request: dict[str, Any] = {
        "method": method.upper(),
        "header": [],
        "url": url_for(path, operation.get("parameters", []), base),
        "description": describe(operation, path, method, public, admin),
    }

    key = f"{method.upper()} {path}"
    if key in MULTIPART:
        request["body"] = {"mode": "formdata", "formdata": MULTIPART[key]}
    else:
        payload = body_example(operation, spec, method, path)
        if payload is not None:
            request["header"].append({"key": "Content-Type", "value": "application/json"})
            request["body"] = {
                "mode": "raw",
                "raw": json.dumps(payload, indent=2),
                "options": {"raw": {"language": "json"}},
            }

    if public:
        request["auth"] = {"type": "noauth"}

    return {"name": name, "request": request, "response": []}


def title_for(operation: dict, method: str, path: str) -> str:
    if operation.get("summary"):
        return operation["summary"]
    return f"{method.upper()} {path.split('/v1/')[-1]}"


# --------------------------------------------------------------------------- #
# Collection assembly
# --------------------------------------------------------------------------- #

def build(specs: dict[str, dict]) -> dict:
    folders: dict[str, list[dict]] = {}
    db_folders: dict[str, list[dict]] = {}

    def add(folder: str, item: dict) -> None:
        folders.setdefault(folder, []).append(item)

    # --- health, one entry per service, straight to the service port --------
    gateway = specs.get("api-gateway", {})
    if "/v1/health" in gateway.get("paths", {}):
        add(F_HEALTH, make_item("Gateway health", "get", "/v1/health",
                                gateway["paths"]["/v1/health"]["get"], gateway))

    direct: list[dict] = []
    for name, port, segment, label in SERVICES:
        if name == "api-gateway" or name not in specs:
            continue
        spec = specs[name]
        operation = spec.get("paths", {}).get("/v1/health", {}).get("get")
        if not operation:
            continue
        var = "{{" + (segment or "gateway") + "Url}}"
        item = make_item(f"{label} ({name}:{port})", "get", "/v1/health",
                         operation, spec, base=var)
        item["request"]["description"] = (
            f"Liveness check for **{name}**, bypassing the gateway on port {port}.\n\n"
            "Use this to tell a failed service apart from a failed gateway."
        )
        direct.append(item)
    if direct:
        add(F_HEALTH, {
            "name": "Direct service health",
            "description": "Each service on its own port, bypassing the gateway.",
            "item": direct,
        })

    # --- everything else ----------------------------------------------------
    for name, _port, segment, label in SERVICES:
        spec = specs.get(name)
        if not spec:
            continue
        for path, methods in sorted(spec.get("paths", {}).items()):
            if path == "/v1/health":
                continue
            for method, operation in methods.items():
                if method not in ("get", "post", "put", "patch", "delete"):
                    continue
                tag = (operation.get("tags") or ["Other"])[0]
                title = title_for(operation, method, path)

                if tag == "DB Admin":
                    model, _data = DB_EXAMPLES.get(segment or "", DB_DEFAULT)
                    item = make_item(title, method, path, operation, spec)
                    for variable in item["request"]["url"].get("variable", []):
                        if variable["key"] == "model":
                            variable["value"] = model
                    item["request"]["url"]["raw"] = item["request"]["url"]["raw"]
                    db_folders.setdefault(label, []).append(item)
                    continue

                folder = FOLDER_MAP.get((name, tag))
                if folder is None:
                    folder = f"{label} · {tag}"
                if name == "auth-service" and tag == "Auth" and path in PUBLIC_PATHS:
                    folder = F_AUTH_PUBLIC

                add(folder, make_item(title, method, path, operation, spec))

    # --- two logins, so switching between roles is one click ----------------
    public_items = folders.get(F_AUTH_PUBLIC, [])
    login = next((i for i in public_items if i["request"]["url"]["raw"].endswith("/auth/login")), None)
    if login:
        admin_login = json.loads(json.dumps(login))
        admin_login["name"] = "Login (admin)"
        admin_login["request"]["body"]["raw"] = json.dumps(
            {"email": "{{adminEmail}}", "password": "{{adminPassword}}"}, indent=2)
        admin_login["request"]["description"] = (
            "Sign in as the seeded platform administrator and store the tokens.\n\n"
            "`GET /v1/auth/login` returns `{ accessToken, refreshToken, tokenType }`; "
            "the test script writes the first two into collection variables, so every "
            "admin request in this collection works immediately afterwards.\n\n"
            "**Run this first** for anything under Users, Roles, Integrations or "
            "Database Admin — those need the `admin:access` permission."
        )
        admin_login["event"] = [{"listen": "test",
                                 "script": {"type": "text/javascript",
                                            "exec": SAVE_TOKENS.splitlines()}}]

        login["name"] = "Login (traveler)"
        login["request"]["description"] = (
            "Sign in as a normal traveler account and store the tokens.\n\n"
            "Use this for the traveler-facing endpoints (profile, map, assistant). "
            "It does **not** grant `admin:access`, so admin folders will answer 403."
        )
        login["event"] = [{"listen": "test",
                           "script": {"type": "text/javascript",
                                      "exec": SAVE_TOKENS.splitlines()}}]

        public_items.insert(0, admin_login)
        public_items.remove(login)
        public_items.insert(1, login)

    # Refresh should roll the stored tokens forward too.
    for item in public_items:
        if item["request"]["url"]["raw"].endswith("/auth/refresh"):
            item["event"] = [{"listen": "test",
                              "script": {"type": "text/javascript",
                                         "exec": SAVE_TOKENS.splitlines()}}]

    # --- internal endpoint, written by hand (excluded from Swagger) ---------
    add(F_INTERNAL, {
        "name": "Resolve integration credentials (internal)",
        "request": {
            "method": "GET",
            "header": [{"key": "x-internal-token", "value": "{{internalToken}}"}],
            "url": {
                "raw": "{{authUrl}}/v1/auth/internal/integrations/:provider",
                "host": ["{{authUrl}}"],
                "path": ["v1", "auth", "internal", "integrations", ":provider"],
                "variable": [{"key": "provider", "value": "{{provider}}"}],
            },
            "auth": {"type": "noauth"},
            "description": (
                "Returns a provider's credentials **in clear text** for other "
                "services to consume.\n\n"
                "`GET /v1/auth/internal/integrations/:provider`\n\n"
                "**Auth:** the `x-internal-token` shared secret "
                "(`INTERNAL_SERVICE_TOKEN`), not a JWT.\n\n"
                "**This is not reachable through the gateway** — it targets "
                "auth-service directly on `{{authUrl}}`, because the gateway "
                "returns 404 for any `/v1/*/internal/**` path so credentials "
                "can never be relayed to the outside world.\n\n"
                "This is how map-service resolves its Mapbox and Google keys and "
                "how ai-service resolves Gemini and ElevenLabs, which is why a "
                "key saved in the admin portal takes effect without a restart."
            ),
        },
        "response": [],
    })

    # --- order the tree -----------------------------------------------------
    if db_folders:
        ordered_labels = [label for _n, _p, _s, label in SERVICES if label in db_folders]
        folders[F_DB] = [
            {"name": label,
             "description": f"Tables owned by {label}.",
             "item": db_folders[label]}
            for label in ordered_labels
        ]

    def sort_key(folder_name: str) -> tuple[int, str]:
        return (0, folder_name) if folder_name[:2].isdigit() else (1, folder_name)

    items = []
    for folder_name in sorted(folders, key=sort_key):
        folder: dict[str, Any] = {"name": folder_name, "item": folders[folder_name]}
        if folder_name in FOLDER_DESCRIPTIONS:
            folder["description"] = FOLDER_DESCRIPTIONS[folder_name]
        items.append(folder)

    return {
        "info": {
            "name": COLLECTION_NAME,
            "schema": SCHEMA,
            "description": overview(specs),
        },
        "auth": {"type": "bearer",
                 "bearer": [{"key": "token", "value": "{{accessToken}}", "type": "string"}]},
        "event": [{
            "listen": "prerequest",
            "script": {"type": "text/javascript", "exec": [
                "// Warn early instead of letting every request fail with a bare 401.",
                "const needsToken = !pm.request.url.toString().includes('/auth/login')",
                "  && !pm.request.url.toString().includes('/health');",
                "if (needsToken && !pm.collectionVariables.get('accessToken')) {",
                "  console.warn('No accessToken set — run \"02 · Auth · Public > Login\" first.');",
                "}",
            ]},
        }],
        "variable": collection_variables(),
        "item": items,
    }


def collection_variables() -> list[dict]:
    values = [
        ("baseUrl", "http://localhost:4000", "API gateway — the only entry point clients should use."),
        ("accessToken", "", "Filled in automatically by the Login requests."),
        ("refreshToken", "", "Filled in automatically by the Login requests."),
        ("adminEmail", "admin@travelerguide.com", "Seeded super_admin account."),
        ("adminPassword", "Admin@123456", "Seeded super_admin password."),
        ("travelerEmail", "traveler@guide.test", "Normal traveler account."),
        ("travelerPassword", "Traveler@123", "Normal traveler password."),
        ("userId", "", "A user id, for the user-scoped requests."),
        ("resourceId", "", "Generic :id path parameter (user id, role id …)."),
        ("roleName", "traveler", "Role name, for removing a role from a user."),
        ("photoId", "", "Gallery photo id."),
        ("platform", "instagram", "Social platform key."),
        ("provider", "google_maps", "Integration provider key."),
        ("rowId", "", "Primary key of a row, for the table editor."),
        ("resetToken", "", "Password reset token from the forgot-password response."),
        ("otp", "0000", "Registration OTP (returned in the response in development)."),
        ("internalToken", "", "INTERNAL_SERVICE_TOKEN, for the internal folder."),
    ]
    for name, port, segment, label in SERVICES:
        if name == "api-gateway":
            continue
        values.append((f"{segment}Url", f"http://localhost:{port}",
                       f"{label} service, direct (bypasses the gateway)."))
    return [{"key": k, "value": v, "type": "string", "description": d} for k, v, d in values]


def overview(specs: dict[str, dict]) -> str:
    total = sum(
        1
        for spec in specs.values()
        for methods in spec.get("paths", {}).values()
        for method in methods
        if method in ("get", "post", "put", "patch", "delete")
    )
    return f"""# Traveler Guide API

Generated from the services' own OpenAPI documents by
`scripts/generate-postman.py`, covering **{total} operations** across
**{len(specs)} services**. Re-run that script after changing a route so this
collection cannot drift from the code.

## Getting started

1. Start the stack: `pnpm dev:all`
2. Select the **Traveler Guide — Local** environment.
3. Run **02 · Auth · Public → Login (admin)**. It stores `accessToken` and
   `refreshToken` automatically; every other request inherits them.

## How requests reach a service

Everything goes through the gateway on `{{{{baseUrl}}}}` (`http://localhost:4000`).
The gateway routes on the first path element after `/v1` — `/v1/map/...` goes to
map-service, `/v1/auth/...` to auth-service — and forwards the path unchanged,
so the path you see here is the path the service sees.

The gateway also:

- **rejects anonymous requests** to anything outside its small public list
  (registration, login, refresh, forgot/reset password, health);
- **requires the `admin:access` permission** for every `/v1/*/admin/**` path;
- **returns 404 for every `/v1/*/internal/**` path**, so service-to-service
  endpoints can never be reached from outside;
- **strips client-supplied identity headers** and re-mints `x-user-id`,
  `x-user-email`, `x-user-roles` and `x-user-permissions` from the verified
  token, so a caller cannot impersonate anyone by setting a header;
- attaches an `x-correlation-id` to every request for tracing.

## Accounts

| Account | Credentials | Use for |
| --- | --- | --- |
| Administrator | `admin@travelerguide.com` / `Admin@123456` | Users, Roles, Integrations, Database Admin |
| Traveler | `traveler@guide.test` / `Traveler@123` | Profile, Map, Assistant |

## Response shape

Every endpoint answers with the same envelope:

```json
{{ "success": true, "data": {{ }} }}
```

and on failure:

```json
{{ "success": false, "error": {{ "code": "UNAUTHORIZED", "message": "…" }} }}
```

## What is implemented

auth-service, user-service, map-service and ai-service carry real domain logic.
The other nine services are scaffolds: they expose health plus the generic table
editor, and their database holds a single placeholder `ServiceRecord` model.
"""


def environment() -> dict:
    return {
        "name": "Traveler Guide — Local",
        "values": [
            {"key": v["key"], "value": v["value"], "enabled": True,
             "type": "secret" if "Password" in v["key"] or "Token" in v["key"] else "default"}
            for v in collection_variables()
        ],
        "_postman_variable_scope": "environment",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true",
                        help="reuse cached specs instead of querying running services")
    args = parser.parse_args()

    specs = fetch_specs(args.offline)
    collection = build(specs)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    collection_path = OUT_DIR / "Traveler-Guide.postman_collection.json"
    environment_path = OUT_DIR / "Traveler-Guide.Local.postman_environment.json"
    collection_path.write_text(json.dumps(collection, indent=2) + "\n")
    environment_path.write_text(json.dumps(environment(), indent=2) + "\n")

    def count(items: list[dict]) -> int:
        return sum(count(i["item"]) if "item" in i else 1 for i in items)

    print(f"{collection_path.relative_to(REPO)}: "
          f"{count(collection['item'])} requests in {len(collection['item'])} folders")
    print(f"{environment_path.relative_to(REPO)}: "
          f"{len(environment()['values'])} variables")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
