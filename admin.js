/* ==========================================================================
   Ospek Kit — admin.js
   ========================================================================== */
(() => {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rupiah = n => "Rp" + (n || 0).toLocaleString("id-ID");
  const CAT_LABEL = { prabu: "Prabu Kit", fakultas: "Fakultas Kit", jurusan: "Jurusan Kit", satuan: "Satuan" };
  const TAB_TITLE = { dash: "Dashboard", products: "Produk & Stok", requests: "Request Masuk", orders: "Pesanan", settings: "Tampilan & Kontak" };

  function toast(msg, type = "") {
    const t = document.createElement("div");
    t.className = "toast " + type;
    const icon = type === "ok" ? "check_circle" : type === "err" ? "error" : "info";
    t.innerHTML = `<span class="material-symbols-rounded">${icon}</span><span>${msg}</span>`;
    $("#toasts").appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 350); }, 3000);
  }

  const api = async (url, opts = {}) => {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
    let data = {}; try { data = await res.json(); } catch {}
    if (res.status === 401) { showLogin(); throw new Error("unauth"); }
    if (!res.ok) {
      const detail = typeof data.error === "string" ? data.error : JSON.stringify(data);
      throw new Error(`${res.status}: ${detail || "Server error"}`);
    }
    return data;
  };

  /* ---------- Auth ---------- */
  function showLogin() { $("#loginGate").style.display = "grid"; $("#adminApp").hidden = true; }
  function showApp()   { $("#loginGate").style.display = "none"; $("#adminApp").hidden = false; loadDashboard(); }

  async function checkSession() {
    try { const d = await (await fetch("/api/admin/session")).json(); if (d.is_admin) showApp(); else showLogin(); }
    catch { showLogin(); }
  }

  async function login() {
    const pwd = $("#pwd").value;
    if (!pwd) return toast("Isi password dulu", "err");
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pwd }) });
      if (!res.ok) {
        let data = {}; try { data = await res.json(); } catch {}
        return toast(res.status === 401 ? "Password salah" : (data.error || `Server error (${res.status})`), "err");
      }
      $("#pwd").value = ""; toast("Berhasil masuk", "ok"); showApp();
    } catch { toast("Server tidak merespon", "err"); }
  }

  async function logout() { await fetch("/api/admin/logout", { method: "POST" }); showLogin(); toast("Keluar", "ok"); }

  /* ---------- Tabs ---------- */
  function switchTab(tab) {
    $$(".side__link[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".tab").forEach(t => t.classList.remove("active"));
    $("#tab-" + tab).classList.add("active");
    $("#tabTitle").textContent = TAB_TITLE[tab] || tab;
    $("#addProductBtn").style.display = tab === "products" ? "" : "none";
    $("#side").classList?.remove("open");
    $(".side").classList.remove("open");
    if (tab === "dash") loadDashboard();
    if (tab === "products") loadProducts();
    if (tab === "requests") loadRequests();
    if (tab === "orders") loadOrders();
    if (tab === "settings") loadSettings();
  }

  /* ---------- Dashboard ---------- */
  async function loadDashboard() {
    try {
      const s = await api("/api/admin/summary");
      $("#statGrid").innerHTML = [
        { ico: "inventory_2", n: s.products, l: "Total produk", a: false },
        { ico: "warning", n: s.low_stock, l: "Stok menipis (≤10)", a: true },
        { ico: "inbox", n: s.requests_new, l: "Request baru", a: true },
        { ico: "pending_actions", n: s.orders_pending, l: "Pesanan menunggu", a: false },
        { ico: "receipt_long", n: s.orders_total, l: "Total pesanan", a: false },
        { ico: "payments", n: rupiah(s.revenue), l: "Pendapatan", a: true },
      ].map(x => `
        <div class="stat ${x.a ? "accent" : ""}">
          <div class="ico"><span class="material-symbols-rounded">${x.ico}</span></div>
          <b>${x.n}</b><span>${x.l}</span>
        </div>`).join("");
      updatePills(s);
    } catch {}
  }

  function updatePills(s) {
    const rp = $("#reqPill"), op = $("#ordPill");
    if (s.requests_new > 0) { rp.hidden = false; rp.textContent = s.requests_new; } else rp.hidden = true;
    if (s.orders_pending > 0) { op.hidden = false; op.textContent = s.orders_pending; } else op.hidden = true;
  }

  /* ---------- Produk ---------- */
  let products = [];
  async function loadProducts() {
    products = await api("/api/admin/products");
    const tb = $("#productTable tbody");
    if (!products.length) { tb.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">Belum ada produk. Klik "Tambah Produk".</td></tr>`; return; }
    tb.innerHTML = products.map(p => `
      <tr>
        <td>
          <div class="prod-cell">
            <div class="ico" style="background:linear-gradient(135deg, ${p.accent}, var(--navy))"><span class="material-symbols-rounded">${p.icon}</span></div>
            <div><b>${p.name}</b><br><small style="color:var(--muted)">${p.fakultas || ""}${p.jurusan ? " · " + p.jurusan : ""}${p.featured ? " · unggulan" : ""}</small></div>
          </div>
        </td>
        <td><span class="tag ${p.category}">${CAT_LABEL[p.category]}</span></td>
        <td>${rupiah(p.price)}</td>
        <td>
          <div class="stock-ctrl">
            <button data-stock="${p.id}" data-d="-1">−</button>
            <b id="stock-${p.id}">${p.stock}</b>
            <button data-stock="${p.id}" data-d="1">+</button>
          </div>
        </td>
        <td><span class="tag ${p.active ? "on" : "off"}">${p.active ? "Tampil" : "Sembunyi"}</span></td>
        <td>
          <div class="act-btns">
            <button class="icon-btn" data-edit="${p.id}" title="Edit"><span class="material-symbols-rounded" style="font-size:20px">edit</span></button>
            <button class="icon-btn danger" data-del="${p.id}" title="Hapus"><span class="material-symbols-rounded" style="font-size:20px">delete</span></button>
          </div>
        </td>
      </tr>`).join("");

    $$("[data-stock]").forEach(b => b.addEventListener("click", async () => {
      const id = +b.dataset.stock, delta = +b.dataset.d;
      const d = await api(`/api/admin/products/${id}/stock`, { method: "POST", body: JSON.stringify({ delta }) });
      $("#stock-" + id).textContent = d.stock;
      const p = products.find(x => x.id === id); if (p) p.stock = d.stock;
    }));
    $$("[data-edit]").forEach(b => b.addEventListener("click", () => openProductModal(+b.dataset.edit)));
    $$("[data-del]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Hapus produk ini?")) return;
      await api(`/api/admin/products/${b.dataset.del}`, { method: "DELETE" });
      toast("Produk dihapus", "ok"); loadProducts(); loadDashboard();
    }));
  }

  function openProductModal(id) {
    const p = id ? products.find(x => x.id === id) : null;
    $("#prodModalTitle").textContent = p ? "Edit Produk" : "Tambah Produk";
    $("#p_id").value = p ? p.id : "";
    $("#p_name").value = p ? p.name : "";
    $("#p_category").value = p ? p.category : "satuan";
    $("#p_price").value = p ? p.price : 0;
    $("#p_fakultas").value = p ? p.fakultas : "";
    $("#p_jurusan").value = p ? p.jurusan : "";
    $("#p_description").value = p ? p.description : "";
    $("#p_stock").value = p ? p.stock : 0;
    $("#p_accent").value = p ? p.accent : "#2450d8";
    $("#p_icon").value = p ? p.icon : "inventory_2";
    $("#p_items").value = p ? p.items.join("\n") : "";
    $("#p_variants").value = p ? p.variants.join("\n") : "";
    $("#p_custom").checked = p ? p.custom_design : false;
    $("#p_featured").checked = p ? p.featured : false;
    $("#p_active").checked = p ? p.active : true;
    $("#prodOverlay").classList.add("open"); document.body.style.overflow = "hidden";
  }

  async function saveProduct() {
    const id = $("#p_id").value;
    const payload = {
      name: $("#p_name").value.trim(),
      category: $("#p_category").value,
      price: +$("#p_price").value || 0,
      fakultas: $("#p_fakultas").value.trim(),
      jurusan: $("#p_jurusan").value.trim(),
      description: $("#p_description").value.trim(),
      stock: +$("#p_stock").value || 0,
      accent: $("#p_accent").value,
      icon: $("#p_icon").value.trim() || "inventory_2",
      items: $("#p_items").value.split("\n").map(x => x.trim()).filter(Boolean),
      variants: $("#p_variants").value.split("\n").map(x => x.trim()).filter(Boolean),
      custom_design: $("#p_custom").checked,
      featured: $("#p_featured").checked,
      active: $("#p_active").checked,
    };
    if (!payload.name) return toast("Nama produk wajib diisi", "err");
    try {
      if (id) await api(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      else await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
      toast(id ? "Produk diperbarui" : "Produk ditambahkan", "ok");
      closeOverlay("#prodOverlay"); loadProducts(); loadDashboard();
    } catch (e) { toast(e.message, "err"); }
  }

  /* ---------- Requests ---------- */
  const REQ_STATUS = ["baru", "ditinjau", "tersedia", "ditolak"];
  async function loadRequests() {
    const list = await api("/api/admin/requests");
    const box = $("#requestList");
    if (!list.length) { box.innerHTML = emptyState("inbox", "Belum ada request", "Request barang dari pengunjung akan muncul di sini."); return; }
    box.innerHTML = list.map(r => `
      <div class="req-card">
        <div class="req-card__top">
          <div>
            <h4>${r.item_name}</h4>
            <small>${new Date(r.created_at).toLocaleString("id-ID")}</small>
          </div>
          <span class="badge-status ${r.status}">${r.status}</span>
        </div>
        <div class="req-meta">
          ${r.variant ? `<span>Varian: ${r.variant}</span>` : ""}
          <span>Qty: ${r.quantity}</span>
          ${r.name ? `<span>Oleh: ${r.name}</span>` : ""}
          ${r.whatsapp ? `<span>WA: ${r.whatsapp}</span>` : ""}
        </div>
        ${r.note ? `<p style="color:var(--muted);font-size:.9rem">${r.note}</p>` : ""}
        ${r.design && r.design.startsWith("data:image") ? `<img class="req-design" src="${r.design}" alt="design">` : ""}
        <div style="display:flex;gap:10px;margin-top:12px;align-items:center">
          <select class="status-select" data-rs="${r.id}">
            ${REQ_STATUS.map(s => `<option value="${s}" ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          ${r.whatsapp ? `<a class="btn-ghost" href="https://wa.me/${r.whatsapp.replace(/\D/g,'')}" target="_blank" style="padding:8px 14px">Chat WA</a>` : ""}
          <button class="icon-btn danger" data-rdel="${r.id}" title="Hapus" style="margin-left:auto"><span class="material-symbols-rounded" style="font-size:20px">delete</span></button>
        </div>
      </div>`).join("");
    $$("[data-rs]").forEach(sel => sel.addEventListener("change", async () => {
      await api(`/api/admin/requests/${sel.dataset.rs}`, { method: "PUT", body: JSON.stringify({ status: sel.value }) });
      toast("Status request diperbarui", "ok"); loadRequests(); loadDashboard();
    }));
    $$("[data-rdel]").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Hapus request ini?")) return;
      await api(`/api/admin/requests/${b.dataset.rdel}`, { method: "DELETE" });
      toast("Request dihapus", "ok"); loadRequests(); loadDashboard();
    }));
  }

  /* ---------- Orders ---------- */
  const ORDER_STATUS = ["menunggu", "dibayar", "diproses", "selesai", "batal"];
  async function loadOrders() {
    const list = await api("/api/admin/orders");
    const box = $("#orderList");
    if (!list.length) { box.innerHTML = emptyState("receipt_long", "Belum ada pesanan", "Pesanan dari toko akan muncul di sini."); return; }
    box.innerHTML = list.map(o => `
      <div class="order-card">
        <div class="req-card__top">
          <div>
            <h4>#${o.id} · ${o.customer_name}</h4>
            <small>${new Date(o.created_at).toLocaleString("id-ID")} · WA ${o.whatsapp}${o.fakultas ? " · " + o.fakultas : ""}${o.jurusan ? " · " + o.jurusan : ""}</small>
          </div>
          <span class="badge-status ${o.status}">${o.status}</span>
        </div>
        <div class="order-card__items">
          ${o.items.map(it => `<div><span>${it.name}${it.variant ? " (" + it.variant + ")" : ""} × ${it.qty}</span><span>${rupiah(it.price * it.qty)}</span></div>`).join("")}
        </div>
        ${o.note ? `<p style="color:var(--muted);font-size:.88rem">Catatan: ${o.note}</p>` : ""}
        <div style="display:flex;gap:12px;align-items:center;margin-top:10px">
          <span class="order-total">${rupiah(o.total)}</span>
          <select class="status-select" data-os="${o.id}" style="margin-left:auto">
            ${ORDER_STATUS.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <a class="btn-ghost" href="https://wa.me/${o.whatsapp.replace(/\D/g,'')}" target="_blank" style="padding:8px 14px">Chat WA</a>
        </div>
      </div>`).join("");
    $$("[data-os]").forEach(sel => sel.addEventListener("change", async () => {
      await api(`/api/admin/orders/${sel.dataset.os}`, { method: "PUT", body: JSON.stringify({ status: sel.value }) });
      toast("Status pesanan diperbarui", "ok"); loadDashboard();
    }));
  }

  /* ---------- Settings ---------- */
  async function loadSettings() {
    const s = await (await fetch("/api/settings")).json();
    const map = ["brand", "hero_title", "hero_subtitle", "banner_text", "contact_whatsapp", "contact_email", "contact_instagram", "contact_person", "qr_note"];
    map.forEach(k => { const el = $("#s_" + k); if (el) el.value = s[k] || ""; });
  }
  async function saveSettings() {
    const map = ["brand", "hero_title", "hero_subtitle", "banner_text", "contact_whatsapp", "contact_email", "contact_instagram", "contact_person", "qr_note"];
    const payload = {}; map.forEach(k => { const el = $("#s_" + k); if (el) payload[k] = el.value; });
    try { await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) }); toast("Pengaturan tersimpan. Refresh toko buat lihat.", "ok"); }
    catch (e) { toast(e.message, "err"); }
  }

  /* ---------- Utils ---------- */
  const emptyState = (ico, title, sub) => `<div class="empty-state"><span class="material-symbols-rounded">${ico}</span><b>${title}</b><div>${sub}</div></div>`;
  function closeOverlay(sel) { $(sel).classList.remove("open"); document.body.style.overflow = ""; }

  /* ---------- Bind ---------- */
  function bind() {
    $("#loginBtn").addEventListener("click", login);
    $("#pwd").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
    $("#logoutBtn").addEventListener("click", logout);
    $$(".side__link[data-tab]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
    $$("[data-go]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.go)));
    $("#addProductBtn").addEventListener("click", () => openProductModal(null));
    $("#saveProduct").addEventListener("click", saveProduct);
    $("#saveSettings").addEventListener("click", saveSettings);
    $("#sideToggle").addEventListener("click", () => $(".side").classList.toggle("open"));
    $$(".overlay").forEach(o => {
      o.addEventListener("click", e => { if (e.target === o) closeOverlay("#" + o.id); });
      $$("[data-close]", o).forEach(b => b.addEventListener("click", () => closeOverlay("#" + o.id)));
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".overlay.open").forEach(o => closeOverlay("#" + o.id)); });
  }

  bind();
  checkSession();
})();
