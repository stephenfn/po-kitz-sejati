"""
Ospek Kit - Pre Order Perlengkapan Ospek Unpad Jatinangor
Backend: Flask + PostgreSQL (REST API)

Cara jalanin:
    pip install -r requirements.txt
    python app.py
    buka http://127.0.0.1:5000

Admin panel: http://127.0.0.1:5000/admin  (password: dewagantengbanget123)
"""

import json
import os
from datetime import datetime
from functools import wraps

from flask import (Flask, g, jsonify, redirect, render_template, request,
                   session)
import psycopg
from psycopg.rows import dict_row

# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = os.environ.get("DATABASE_URL")
DB_INITIALIZED = False
ADMIN_PASSWORD = "dewagantengbanget123"          # <-- ganti kalau mau
SECRET_KEY = "ganti-secret-key-ini-di-produksi"

app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024   # 8 MB (buat upload design nametag)


# ---------------------------------------------------------------------------
# Database helper
# ---------------------------------------------------------------------------
def get_db():
    global DB_INITIALIZED
    if "db" not in g:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL belum dikonfigurasi")
        g.db = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        if not DB_INITIALIZED:
            init_db()
            DB_INITIALIZED = True
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.errorhandler(Exception)
def handle_error(exc):
    db = g.get("db")
    if db is not None:
        db.rollback()
    detail = str(exc) or "Internal server error"
    return jsonify({"error": f"{type(exc).__name__}: {detail}"}), 500


def init_db():
    if not DATABASE_URL:
        return
    db = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS products (
            id           SERIAL PRIMARY KEY,
            name         TEXT NOT NULL,
            category     TEXT NOT NULL,          -- prabu | fakultas | jurusan | satuan
            fakultas     TEXT DEFAULT '',
            jurusan      TEXT DEFAULT '',
            description  TEXT DEFAULT '',
            price        INTEGER NOT NULL DEFAULT 0,
            stock        INTEGER NOT NULL DEFAULT 0,
            icon         TEXT DEFAULT 'inventory_2',
            accent       TEXT DEFAULT '#2450d8',
            items        TEXT DEFAULT '[]',       -- JSON list isi kit
            variants     TEXT DEFAULT '[]',       -- JSON list varian/warna
            custom_design INTEGER DEFAULT 0,      -- 1 = pembeli upload design
            featured     INTEGER DEFAULT 0,       -- 1 = tampil di banner/iklan
            active       INTEGER DEFAULT 1,
            created_at   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requests (
            id          SERIAL PRIMARY KEY,
            item_name   TEXT NOT NULL,
            variant     TEXT DEFAULT '',
            quantity    INTEGER DEFAULT 1,
            note        TEXT DEFAULT '',
            name        TEXT DEFAULT '',
            whatsapp    TEXT DEFAULT '',
            design      TEXT DEFAULT '',          -- catatan / dataURL design
            status      TEXT DEFAULT 'baru',      -- baru | ditinjau | tersedia | ditolak
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id            SERIAL PRIMARY KEY,
            customer_name TEXT NOT NULL,
            whatsapp      TEXT NOT NULL,
            fakultas      TEXT DEFAULT '',
            jurusan       TEXT DEFAULT '',
            items         TEXT NOT NULL,          -- JSON list item order
            total         INTEGER NOT NULL,
            note          TEXT DEFAULT '',
            status        TEXT DEFAULT 'menunggu',-- menunggu | dibayar | diproses | selesai | batal
            created_at    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL
        );
        """
    )
    db.commit()

    # default settings
    cur = db.execute("SELECT COUNT(*) FROM settings")
    if cur.fetchone()[0] == 0:
        default_settings = {
            "brand": "Ospek Kit",
            "tagline": "Pre-Order Perlengkapan Ospek",
            "hero_title": "Semua Perlengkapan Ospek, Satu Tempat.",
            "hero_subtitle": "Prabu Kit, Fakultas Kit, sampai Jurusan Kit — pre-order sekarang, ambil sebelum hari-H. Nggak ada barangnya? Request aja.",
            "banner_text": "PRE-ORDER DIBUKA  •  GRATIS ONGKIR AREA JATINANGOR  •  BAYAR QRIS  •  READY SEBELUM HARI-H",
            "announcement": "",
            "contact_whatsapp": "6281234567890",
            "contact_email": "ospekkit.unpad@gmail.com",
            "contact_instagram": "@ospekkit.unpad",
            "contact_person": "Kak Angeli",
            "qr_note": "QR ini masih DUMMY untuk prototype. Nanti diganti QRIS asli dari panel admin.",
        }
        db.execute("INSERT INTO settings (id, data) VALUES (1, %s)",
                   (json.dumps(default_settings),))

    # seed produk contoh
    cur = db.execute("SELECT COUNT(*) FROM products")
    if cur.fetchone()[0] == 0:
        now = datetime.now().isoformat(timespec="seconds")
        seed = [
            # (name, category, fakultas, jurusan, desc, price, stock, icon, accent, items, variants, custom, featured)
            ("Prabu Kit Lengkap", "prabu", "", "",
             "Paket lengkap Ospek Kampus (PRABU). Semua wajib-bawa dalam satu tas, tinggal ambil.",
             89000, 40, "backpack", "#2450d8",
             ["Nametag + tali", "Pita medic (4 warna)", "Buku panduan", "Air mineral", "Snack wajib", "Kantong plastik"],
             [], 0, 1),
            ("Fakultas Kit — FMIPA", "fakultas", "FMIPA", "",
             "Perlengkapan ospek tingkat fakultas. Nama fakultas bisa diganti dari panel admin.",
             65000, 30, "science", "#1e9e6a",
             ["Nametag fakultas", "Co-card", "Atribut warna fakultas", "Name bag"],
             [], 0, 1),
            ("Jurusan Kit — Fisika", "jurusan", "FMIPA", "Fisika",
             "Perlengkapan ospek tingkat jurusan. Fakultas & jurusan bisa diganti dari panel admin.",
             55000, 25, "biotech", "#8a4fd8",
             ["Nametag jurusan", "Atribut khas jurusan", "Buku angkatan"],
             [], 0, 0),
            ("Kursi Goyang Lipat", "satuan", "", "",
             "Kursi lipat ringan buat duduk pas ospek. Warna menyesuaikan stok.",
             38000, 60, "chair", "#e0851b",
             [], ["Warna apapun (random)", "Biru", "Kuning", "Hitam"], 0, 0),
            ("Pita Medic", "satuan", "", "",
             "Pita penanda kondisi medis. Pilih warna sesuai instruksi panitia.",
             5000, 200, "medical_services", "#d1394b",
             [], ["Ijo", "Kuning", "Merah", "Putih"], 0, 0),
            ("Promag Tablet", "satuan", "", "",
             "Obat maag, wajib-bawa versi aman. Per strip.",
             9000, 120, "healing", "#1e9e6a",
             [], [], 0, 0),
            ("Oronamin C", "satuan", "", "",
             "Minuman berenergi buat jaga stamina seharian ospek.",
             8000, 150, "local_drink", "#f0a91b",
             [], [], 0, 0),
            ("Nametag Custom", "satuan", "", "",
             "Nametag cetak. Upload design kamu sendiri, atau minta dibuatin.",
             12000, 100, "badge", "#2450d8",
             [], ["Design sendiri (upload)", "Dibuatin panitia kit"], 1, 0),
            ("Name Bag Custom", "satuan", "", "",
             "Name bag / tas identitas. Sistem sama kayak nametag — upload atau dibuatin.",
             15000, 80, "shopping_bag", "#8a4fd8",
             [], ["Design sendiri (upload)", "Dibuatin panitia kit"], 1, 0),
        ]
        for row in seed:
            db.execute(
                """INSERT INTO products
                   (name,category,fakultas,jurusan,description,price,stock,icon,accent,
                    items,variants,custom_design,featured,active,created_at)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,1,%s)""",
                (row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8],
                 json.dumps(row[9]), json.dumps(row[10]), row[11], row[12], now),
            )
    db.commit()
    db.close()


def row_to_product(r):
    return {
        "id": r["id"],
        "name": r["name"],
        "category": r["category"],
        "fakultas": r["fakultas"],
        "jurusan": r["jurusan"],
        "description": r["description"],
        "price": r["price"],
        "stock": r["stock"],
        "icon": r["icon"],
        "accent": r["accent"],
        "items": json.loads(r["items"] or "[]"),
        "variants": json.loads(r["variants"] or "[]"),
        "custom_design": bool(r["custom_design"]),
        "featured": bool(r["featured"]),
        "active": bool(r["active"]),
        "created_at": r["created_at"],
    }


def get_settings():
    r = get_db().execute("SELECT data FROM settings WHERE id=1").fetchone()
    return json.loads(r["data"]) if r else {}


# ---------------------------------------------------------------------------
# Auth admin
# ---------------------------------------------------------------------------
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Halaman
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
def admin_page():
    return render_template("admin.html")


# ---------------------------------------------------------------------------
# API publik
# ---------------------------------------------------------------------------
@app.route("/api/settings")
def api_settings():
    return jsonify(get_settings())


@app.route("/api/products")
def api_products():
    q = (request.args.get("q") or "").strip().lower()
    category = (request.args.get("category") or "").strip().lower()
    db = get_db()
    rows = db.execute("SELECT * FROM products WHERE active=1 ORDER BY featured DESC, id DESC").fetchall()
    products = [row_to_product(r) for r in rows]

    if category and category != "semua":
        products = [p for p in products if p["category"] == category]
    if q:
        def match(p):
            hay = " ".join([
                p["name"], p["description"], p["fakultas"], p["jurusan"],
                " ".join(p["items"]), " ".join(p["variants"]),
            ]).lower()
            return q in hay
        products = [p for p in products if match(p)]
    return jsonify(products)


@app.route("/api/products/<int:pid>")
def api_product(pid):
    r = get_db().execute("SELECT * FROM products WHERE id=%s AND active=1", (pid,)).fetchone()
    if not r:
        return jsonify({"error": "not found"}), 404
    return jsonify(row_to_product(r))


@app.route("/api/requests", methods=["POST"])
def api_create_request():
    d = request.get_json(force=True, silent=True) or {}
    if not (d.get("item_name") or "").strip():
        return jsonify({"error": "Nama barang wajib diisi"}), 400
    db = get_db()
    now = datetime.now().isoformat(timespec="seconds")
    db.execute(
          """INSERT INTO requests (item_name,variant,quantity,note,name,whatsapp,design,status,created_at)
              VALUES (%s,%s,%s,%s,%s,%s,%s, 'baru', %s)""",
        (d.get("item_name", "").strip(), d.get("variant", ""),
         int(d.get("quantity") or 1), d.get("note", ""),
         d.get("name", ""), d.get("whatsapp", ""), d.get("design", ""), now),
    )
    db.commit()
    return jsonify({"ok": True, "message": "Request kamu udah masuk ke panitia. Ditunggu ya!"}), 201


@app.route("/api/orders", methods=["POST"])
def api_create_order():
    d = request.get_json(force=True, silent=True) or {}
    items = d.get("items") or []
    if not items:
        return jsonify({"error": "Keranjang masih kosong"}), 400
    if not (d.get("customer_name") or "").strip():
        return jsonify({"error": "Nama wajib diisi"}), 400
    if not (d.get("whatsapp") or "").strip():
        return jsonify({"error": "Nomor WhatsApp wajib diisi"}), 400

    db = get_db()
    total = 0
    clean_items = []
    for it in items:
        r = db.execute("SELECT * FROM products WHERE id=%s AND active=1", (it.get("id"),)).fetchone()
        if not r:
            continue
        qty = max(1, int(it.get("qty") or 1))
        line = {
            "id": r["id"], "name": r["name"], "price": r["price"],
            "qty": qty, "variant": it.get("variant", ""), "design": it.get("design", ""),
        }
        total += r["price"] * qty
        clean_items.append(line)

    if not clean_items:
        return jsonify({"error": "Item tidak valid"}), 400

    now = datetime.now().isoformat(timespec="seconds")
    cur = db.execute(
          """INSERT INTO orders (customer_name,whatsapp,fakultas,jurusan,items,total,note,status,created_at)
              VALUES (%s,%s,%s,%s,%s,%s,%s, 'menunggu', %s)
              RETURNING id""",
        (d.get("customer_name").strip(), d.get("whatsapp").strip(),
         d.get("fakultas", ""), d.get("jurusan", ""),
         json.dumps(clean_items, ensure_ascii=False), total, d.get("note", ""), now),
    )
    # kurangi stok
    for it in clean_items:
        db.execute("UPDATE products SET stock = GREATEST(0, stock - %s) WHERE id=%s", (it["qty"], it["id"]))
    db.commit()
    return jsonify({"ok": True, "order_id": cur.fetchone()["id"], "total": total,
                    "message": "Pesanan dibuat. Silakan bayar via QRIS."}), 201


# ---------------------------------------------------------------------------
# API admin
# ---------------------------------------------------------------------------
@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    d = request.get_json(force=True, silent=True) or {}
    if d.get("password") == ADMIN_PASSWORD:
        session["is_admin"] = True
        return jsonify({"ok": True})
    return jsonify({"error": "Password salah"}), 401


@app.route("/api/admin/logout", methods=["POST"])
def api_admin_logout():
    session.pop("is_admin", None)
    return jsonify({"ok": True})


@app.route("/api/admin/session")
def api_admin_session():
    return jsonify({"is_admin": bool(session.get("is_admin"))})


@app.route("/api/admin/summary")
@admin_required
def api_admin_summary():
    db = get_db()
    return jsonify({
        "products": db.execute("SELECT COUNT(*) c FROM products").fetchone()["c"],
        "low_stock": db.execute("SELECT COUNT(*) c FROM products WHERE stock<=10").fetchone()["c"],
        "requests_new": db.execute("SELECT COUNT(*) c FROM requests WHERE status='baru'").fetchone()["c"],
        "orders_pending": db.execute("SELECT COUNT(*) c FROM orders WHERE status='menunggu'").fetchone()["c"],
        "orders_total": db.execute("SELECT COUNT(*) c FROM orders").fetchone()["c"],
        "revenue": db.execute("SELECT COALESCE(SUM(total),0) s FROM orders WHERE status IN ('dibayar','diproses','selesai')").fetchone()["s"],
    })


# ---- produk (admin) ----
@app.route("/api/admin/products", methods=["GET"])
@admin_required
def api_admin_products():
    rows = get_db().execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    return jsonify([row_to_product(r) for r in rows])


def _product_payload(d):
    return (
        d.get("name", "").strip(),
        d.get("category", "satuan"),
        d.get("fakultas", ""),
        d.get("jurusan", ""),
        d.get("description", ""),
        int(d.get("price") or 0),
        int(d.get("stock") or 0),
        d.get("icon", "inventory_2") or "inventory_2",
        d.get("accent", "#2450d8") or "#2450d8",
        json.dumps(d.get("items") or []),
        json.dumps(d.get("variants") or []),
        1 if d.get("custom_design") else 0,
        1 if d.get("featured") else 0,
        1 if d.get("active", True) else 0,
    )


@app.route("/api/admin/products", methods=["POST"])
@admin_required
def api_admin_product_create():
    d = request.get_json(force=True, silent=True) or {}
    if not (d.get("name") or "").strip():
        return jsonify({"error": "Nama produk wajib diisi"}), 400
    now = datetime.now().isoformat(timespec="seconds")
    p = _product_payload(d)
    cur = get_db().execute(
        """INSERT INTO products
           (name,category,fakultas,jurusan,description,price,stock,icon,accent,items,variants,custom_design,featured,active,created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""", p + (now,))
    get_db().commit()
    return jsonify({"ok": True, "id": cur.fetchone()["id"]}), 201


@app.route("/api/admin/products/<int:pid>", methods=["PUT"])
@admin_required
def api_admin_product_update(pid):
    d = request.get_json(force=True, silent=True) or {}
    p = _product_payload(d)
    get_db().execute(
        """UPDATE products SET name=%s,category=%s,fakultas=%s,jurusan=%s,description=%s,price=%s,stock=%s,
           icon=%s,accent=%s,items=%s,variants=%s,custom_design=%s,featured=%s,active=%s WHERE id=%s""",
        p + (pid,))
    get_db().commit()
    return jsonify({"ok": True})


@app.route("/api/admin/products/<int:pid>", methods=["DELETE"])
@admin_required
def api_admin_product_delete(pid):
    get_db().execute("DELETE FROM products WHERE id=%s", (pid,))
    get_db().commit()
    return jsonify({"ok": True})


@app.route("/api/admin/products/<int:pid>/stock", methods=["POST"])
@admin_required
def api_admin_stock(pid):
    d = request.get_json(force=True, silent=True) or {}
    delta = int(d.get("delta") or 0)
    get_db().execute("UPDATE products SET stock = GREATEST(0, stock + %s) WHERE id=%s", (delta, pid))
    get_db().commit()
    r = get_db().execute("SELECT stock FROM products WHERE id=%s", (pid,)).fetchone()
    return jsonify({"ok": True, "stock": r["stock"] if r else 0})


# ---- requests (admin) ----
@app.route("/api/admin/requests", methods=["GET"])
@admin_required
def api_admin_requests():
    rows = get_db().execute("SELECT * FROM requests ORDER BY id DESC").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/admin/requests/<int:rid>", methods=["PUT"])
@admin_required
def api_admin_request_update(rid):
    d = request.get_json(force=True, silent=True) or {}
    status = d.get("status", "baru")
    get_db().execute("UPDATE requests SET status=%s WHERE id=%s", (status, rid))
    get_db().commit()
    return jsonify({"ok": True})


@app.route("/api/admin/requests/<int:rid>", methods=["DELETE"])
@admin_required
def api_admin_request_delete(rid):
    get_db().execute("DELETE FROM requests WHERE id=%s", (rid,))
    get_db().commit()
    return jsonify({"ok": True})


# ---- orders (admin) ----
@app.route("/api/admin/orders", methods=["GET"])
@admin_required
def api_admin_orders():
    rows = get_db().execute("SELECT * FROM orders ORDER BY id DESC").fetchall()
    out = []
    for r in rows:
        o = dict(r)
        o["items"] = json.loads(o["items"] or "[]")
        out.append(o)
    return jsonify(out)


@app.route("/api/admin/orders/<int:oid>", methods=["PUT"])
@admin_required
def api_admin_order_update(oid):
    d = request.get_json(force=True, silent=True) or {}
    get_db().execute("UPDATE orders SET status=%s WHERE id=%s", (d.get("status", "menunggu"), oid))
    get_db().commit()
    return jsonify({"ok": True})


# ---- settings (admin) ----
@app.route("/api/admin/settings", methods=["PUT"])
@admin_required
def api_admin_settings_update():
    d = request.get_json(force=True, silent=True) or {}
    current = get_settings()
    current.update({k: v for k, v in d.items()})
    get_db().execute("UPDATE settings SET data=%s WHERE id=1", (json.dumps(current, ensure_ascii=False),))
    get_db().commit()
    return jsonify({"ok": True, "settings": current})


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Ospek Kit siap. Buka http://127.0.0.1:5000  |  admin: /admin")
    app.run(debug=True, port=5000)
