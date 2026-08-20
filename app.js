/* ==========================================================================
   Ospek Kit — app.js (storefront)
   ========================================================================== */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rupiah = n => "Rp" + (n || 0).toLocaleString("id-ID");

  const CAT_LABEL = { prabu: "Prabu Kit", fakultas: "Fakultas Kit", jurusan: "Jurusan Kit", satuan: "Satuan" };

  const state = {
    settings: {},
    products: [],
    filtered: [],
    cat: "semua",
    q: "",
    cart: JSON.parse(localStorage.getItem("ospekkit_cart") || "[]"),
    current: null,          // produk yang dibuka di modal
    currentVariant: "",
    currentDesign: "",
    currentQty: 1,
  };

  /* ---------- Toast ---------- */
  function toast(msg, type = "") {
    const t = document.createElement("div");
    t.className = "toast " + type;
    const icon = type === "ok" ? "check_circle" : type === "err" ? "error" : "info";
    t.innerHTML = `<span class="material-symbols-rounded">${icon}</span><span>${msg}</span>`;
    $("#toasts").appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 350); }, 3200);
  }

  /* ---------- Fetch data ---------- */
  async function loadSettings() {
    try { state.settings = await (await fetch("/api/settings")).json(); }
    catch { state.settings = {}; }
    applySettings();
  }

  function applySettings() {
    const s = state.settings;
    if (s.brand) {
      const [a, b] = splitBrand(s.brand);
      $("#brandName").innerHTML = `${a}<b>${b}</b>`;
      $("#footBrand").textContent = s.brand;
    }
    if (s.hero_title)    $("#heroTitle").innerHTML = highlightLast(s.hero_title);
    if (s.hero_subtitle) $("#heroSubtitle").textContent = s.hero_subtitle;
    // ticker (dobel biar mulus loop-nya)
    const bt = (s.banner_text || "PRE-ORDER DIBUKA").split("•").map(x => x.trim()).filter(Boolean);
    const line = bt.map(x => `<span style="padding:0 26px">◆ ${x}</span>`).join("");
    $("#ticker").innerHTML = line + line;
    renderContacts();
  }

  function splitBrand(name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return [parts[0], " " + parts.slice(1).join(" ")];
    const mid = Math.ceil(name.length / 2);
    return [name.slice(0, mid), name.slice(mid)];
  }
  function highlightLast(title) {
    const words = title.trim().split(" ");
    if (words.length < 2) return title;
    const last2 = words.slice(-2).join(" ");
    return words.slice(0, -2).join(" ") + ` <span class="hl">${last2}</span>`;
  }

  async function loadProducts() {
    try {
      const url = `/api/products?category=${encodeURIComponent(state.cat)}&q=${encodeURIComponent(state.q)}`;
      state.filtered = await (await fetch(url)).json();
    } catch { state.filtered = []; }
    renderGrid();
  }

  async function loadAll() {
    try { state.products = await (await fetch("/api/products")).json(); } catch {}
    $("#statProducts").textContent = state.products.length;
    renderHeroCard();
  }

  /* ---------- Render hero card ---------- */
  function renderHeroCard() {
    const feat = state.products.find(p => p.featured) || state.products[0];
    if (!feat) return;
    const chips = (feat.items.length ? feat.items : feat.variants).slice(0, 4)
      .map(x => `<span class="chip">${x}</span>`).join("");
    $("#heroCard").innerHTML = `
      <div class="hero__tile" style="background:linear-gradient(135deg, ${feat.accent}, var(--navy))">
        <span class="material-symbols-rounded">${feat.icon}</span>
      </div>
      <span class="pd__cat">${CAT_LABEL[feat.category] || feat.category}</span>
      <h3>${feat.name}</h3>
      <div class="hero__chip-row">${chips}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="price">${rupiah(feat.price)}</span>
        <button class="cart-btn" data-hero="${feat.id}"><span class="material-symbols-rounded">visibility</span> Lihat</button>
      </div>`;
    $("[data-hero]", $("#heroCard"))?.addEventListener("click", () => openProduct(feat.id));
  }

  /* ---------- Render grid ---------- */
  function stockLabel(p) {
    if (p.stock <= 0) return `<span class="card__stock out">Stok habis</span>`;
    if (p.stock <= 10) return `<span class="card__stock low">Sisa ${p.stock}</span>`;
    return `<span class="card__stock ok">Stok ${p.stock}</span>`;
  }

  function renderGrid() {
    const grid = $("#grid");
    if (!state.filtered.length) {
      grid.innerHTML = `
        <div class="empty">
          <span class="material-symbols-rounded">search_off</span>
          <b>Barang nggak ketemu</b>
          <div>Kami mungkin belum jual "<strong>${state.q || "itu"}</strong>". Request aja biar diadain!</div>
          <button id="emptyReq"><span class="material-symbols-rounded" style="vertical-align:-4px">add</span> Request Barang Ini</button>
        </div>`;
      $("#emptyReq")?.addEventListener("click", () => { $("#reqItem").value = state.q; openOverlay("#reqOverlay"); });
      return;
    }
    grid.innerHTML = state.filtered.map(p => `
      <article class="card" data-id="${p.id}">
        <div class="card__media" style="background:linear-gradient(135deg, ${p.accent}, var(--navy))">
          ${p.featured ? `<span class="card__badge">Unggulan</span>` : ""}
          <button class="card__fav" title="Favorit"><span class="material-symbols-rounded">favorite</span></button>
          <span class="material-symbols-rounded">${p.icon}</span>
        </div>
        <div class="card__body">
          <span class="card__cat">${CAT_LABEL[p.category] || p.category}${p.fakultas ? " · " + p.fakultas : ""}</span>
          <h3 class="card__title">${p.name}</h3>
          <p class="card__desc">${p.description || ""}</p>
          <div class="card__foot">
            <span class="card__price">${rupiah(p.price)}</span>
            ${stockLabel(p)}
          </div>
          <button class="card__add" data-add="${p.id}">
            <span class="material-symbols-rounded">${p.variants.length || p.custom_design ? "tune" : "add_shopping_cart"}</span>
            ${p.variants.length || p.custom_design ? "Pilih opsi" : "Tambah"}
          </button>
        </div>
      </article>`).join("");

    // interaksi kartu
    $$(".card", grid).forEach(c => {
      const id = +c.dataset.id;
      c.addEventListener("click", e => { if (!e.target.closest("[data-add]") && !e.target.closest(".card__fav")) openProduct(id); });
    });
    $$("[data-add]", grid).forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const p = state.filtered.find(x => x.id === +b.dataset.add);
      if (p.variants.length || p.custom_design) openProduct(p.id);
      else quickAdd(p);
    }));
    $$(".card__fav", grid).forEach(b => b.addEventListener("click", e => {
      e.stopPropagation(); b.querySelector(".material-symbols-rounded").style.fontVariationSettings = "'FILL' 1";
      toast("Ditandai favorit", "ok");
    }));

    // reveal stagger
    requestAnimationFrame(() => $$(".card", grid).forEach((c, i) => setTimeout(() => c.classList.add("in"), i * 55)));
  }

  /* ---------- Product modal ---------- */
  function openProduct(id) {
    const p = state.products.find(x => x.id === id) || state.filtered.find(x => x.id === id);
    if (!p) return;
    state.current = p; state.currentVariant = p.variants[0] || ""; state.currentDesign = ""; state.currentQty = 1;

    const itemsHtml = p.items.length ? `
      <div class="pd__section-title"><span class="material-symbols-rounded">checklist</span> Isi Kit</div>
      <ul class="pd__items">${p.items.map(i => `<li><span class="material-symbols-rounded">check_circle</span>${i}</li>`).join("")}</ul>` : "";

    const variantHtml = p.variants.length ? `
      <div class="pd__section-title"><span class="material-symbols-rounded">palette</span> Pilih varian</div>
      <div class="variant-row" id="pdVariants">
        ${p.variants.map((v, i) => `<button class="variant ${i === 0 ? "active" : ""}" data-v="${v}">${v}</button>`).join("")}
      </div>` : "";

    const uploadHtml = p.custom_design ? `
      <div class="pd__section-title"><span class="material-symbols-rounded">image</span> Upload design (opsional)</div>
      <div class="upload-box" id="pdUploadBox"><span class="material-symbols-rounded">upload_file</span><div>Klik untuk upload gambar design kamu</div></div>
      <input type="file" id="pdUpload" accept="image/*" hidden>
      <img class="upload-preview" id="pdPreview" hidden>` : "";

    $("#pdBody").innerHTML = `
      <div class="pd__media" style="background:linear-gradient(135deg, ${p.accent}, var(--navy))">
        <span class="material-symbols-rounded">${p.icon}</span>
      </div>
      <span class="pd__cat">${CAT_LABEL[p.category] || p.category}${p.fakultas ? " · " + p.fakultas : ""}${p.jurusan ? " · " + p.jurusan : ""}</span>
      <h2>${p.name}</h2>
      <div class="pd__price">${rupiah(p.price)} <span style="font-size:.9rem;font-weight:600;color:var(--muted)">· ${p.stock > 0 ? "stok " + p.stock : "stok habis"}</span></div>
      <p class="pd__desc">${p.description || ""}</p>
      ${itemsHtml}${variantHtml}${uploadHtml}
      <div class="qty-row">
        <div class="qty">
          <button id="qtyMinus">−</button>
          <input id="qtyInput" type="text" value="1" readonly>
          <button id="qtyPlus">+</button>
        </div>
        <button class="btn-primary" id="pdAdd" ${p.stock <= 0 ? "disabled style='opacity:.5;cursor:not-allowed'" : ""}>
          <span class="material-symbols-rounded">add_shopping_cart</span> ${p.stock <= 0 ? "Stok habis" : "Tambah ke keranjang"}
        </button>
      </div>`;

    // varian
    $$("#pdVariants .variant").forEach(b => b.addEventListener("click", () => {
      $$("#pdVariants .variant").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); state.currentVariant = b.dataset.v;
    }));
    // qty
    const qi = $("#qtyInput");
    $("#qtyMinus").onclick = () => { state.currentQty = Math.max(1, state.currentQty - 1); qi.value = state.currentQty; };
    $("#qtyPlus").onclick  = () => { state.currentQty = Math.min(p.stock || 99, state.currentQty + 1); qi.value = state.currentQty; };
    // upload
    if (p.custom_design) {
      $("#pdUploadBox").onclick = () => $("#pdUpload").click();
      $("#pdUpload").onchange = e => readImage(e.target.files[0], dataUrl => {
        state.currentDesign = dataUrl; const img = $("#pdPreview"); img.src = dataUrl; img.hidden = false;
      });
    }
    $("#pdAdd").onclick = () => { if (p.stock > 0) { addToCart(p, state.currentQty, state.currentVariant, state.currentDesign); closeOverlay("#pdOverlay"); } };

    openOverlay("#pdOverlay");
  }

  function readImage(file, cb) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast("Gambar maks 3MB", "err");
    const fr = new FileReader(); fr.onload = () => cb(fr.result); fr.readAsDataURL(file);
  }

  /* ---------- Cart ---------- */
  function quickAdd(p) { if (p.stock <= 0) return toast("Stok habis", "err"); addToCart(p, 1, "", ""); }

  function addToCart(p, qty, variant, design) {
    const key = p.id + "|" + variant + "|" + (design ? "d" : "");
    const found = state.cart.find(c => c.key === key);
    if (found) found.qty += qty;
    else state.cart.push({ key, id: p.id, name: p.name, price: p.price, icon: p.icon, accent: p.accent, qty, variant, design });
    persistCart(); bumpCart();
    toast(`${p.name} masuk keranjang`, "ok");
  }

  function persistCart() { localStorage.setItem("ospekkit_cart", JSON.stringify(state.cart)); }
  function cartCount() { return state.cart.reduce((a, c) => a + c.qty, 0); }
  function cartTotal() { return state.cart.reduce((a, c) => a + c.price * c.qty, 0); }

  function bumpCart() {
    const el = $("#cartCount"), n = cartCount();
    el.textContent = n; el.classList.toggle("show", n > 0);
    el.style.transform = "scale(1.4)"; setTimeout(() => el.style.transform = "", 180);
  }

  function renderCart() {
    const body = $("#cartBody"), foot = $("#cartFoot");
    if (!state.cart.length) {
      body.innerHTML = `<div class="cart-empty"><span class="material-symbols-rounded">shopping_cart</span><p>Keranjang masih kosong.<br>Yuk isi dulu!</p></div>`;
      foot.innerHTML = ""; return;
    }
    body.innerHTML = state.cart.map((c, i) => `
      <div class="cart-item">
        <div class="cart-item__ico" style="background:linear-gradient(135deg, ${c.accent}, var(--navy))"><span class="material-symbols-rounded">${c.icon}</span></div>
        <div class="cart-item__info">
          <b>${c.name}</b>
          <small>${c.variant ? c.variant + " · " : ""}${c.design ? "design custom · " : ""}${c.qty} × ${rupiah(c.price)}</small>
          <span class="cart-item__price">${rupiah(c.price * c.qty)}</span>
        </div>
        <button class="rm" data-rm="${i}"><span class="material-symbols-rounded">delete</span></button>
      </div>`).join("");
    foot.innerHTML = `
      <div class="summary-row"><span>Subtotal</span><span>${rupiah(cartTotal())}</span></div>
      <div class="summary-row total"><span>Total</span><span>${rupiah(cartTotal())}</span></div>
      <button class="btn-primary" id="checkoutBtn" style="width:100%;margin-top:12px"><span class="material-symbols-rounded">qr_code_2</span> Checkout &amp; Bayar QRIS</button>`;
    $$("[data-rm]", body).forEach(b => b.addEventListener("click", () => {
      state.cart.splice(+b.dataset.rm, 1); persistCart(); bumpCart(); renderCart();
    }));
    $("#checkoutBtn").addEventListener("click", openCheckout);
  }

  /* ---------- Checkout + QR dummy ---------- */
  function openCheckout() {
    if (!state.cart.length) return;
    closeDrawer();
    $("#coBody").innerHTML = `
      <button class="modal__x" data-close><span class="material-symbols-rounded">close</span></button>
      <div class="pd">
        <span class="pd__cat">Checkout</span>
        <h2>Data Pemesan</h2>
        <p class="pd__desc">Isi data biar panitia bisa proses & antar pesananmu.</p>
        <div class="row2">
          <div class="field"><label>Nama lengkap *</label><input id="coName" placeholder="Nama"></div>
          <div class="field"><label>WhatsApp *</label><input id="coWa" placeholder="08xxx"></div>
        </div>
        <div class="row2">
          <div class="field"><label>Fakultas</label><input id="coFak" placeholder="cth: FMIPA"></div>
          <div class="field"><label>Jurusan</label><input id="coJur" placeholder="cth: Fisika"></div>
        </div>
        <div class="field"><label>Catatan (opsional)</label><textarea id="coNote" placeholder="cth: ambil di gerbang lama"></textarea></div>
        <div class="summary-row total" style="margin:6px 0 14px"><span>Total bayar</span><span>${rupiah(cartTotal())}</span></div>
        <button class="btn-primary" id="coPay" style="width:100%"><span class="material-symbols-rounded">qr_code_2</span> Lanjut ke Pembayaran QRIS</button>
      </div>`;
    bindClose($("#coBody"));
    $("#coPay").addEventListener("click", submitOrder);
    openOverlay("#coOverlay");
  }

  async function submitOrder() {
    const name = $("#coName").value.trim(), wa = $("#coWa").value.trim();
    if (!name) return toast("Nama wajib diisi", "err");
    if (!wa)   return toast("Nomor WhatsApp wajib diisi", "err");
    const payload = {
      customer_name: name, whatsapp: wa,
      fakultas: $("#coFak").value.trim(), jurusan: $("#coJur").value.trim(), note: $("#coNote").value.trim(),
      items: state.cart.map(c => ({ id: c.id, qty: c.qty, variant: c.variant, design: c.design })),
    };
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) return toast(data.error || "Gagal membuat pesanan", "err");
      showQR(data.order_id, data.total);
      state.cart = []; persistCart(); bumpCart(); renderCart();
      loadAll(); loadProducts();
    } catch { toast("Server tidak merespon", "err"); }
  }

  function showQR(orderId, total) {
    const qr = makeQrSvg("OSPEKKIT-" + orderId + "-" + total);
    $("#coBody").innerHTML = `
      <button class="modal__x" data-close><span class="material-symbols-rounded">close</span></button>
      <div class="qr-wrap">
        <span class="pd__cat">Pembayaran</span>
        <h2 style="color:var(--navy)">Scan untuk Bayar</h2>
        <div class="qr-total">${rupiah(total)}</div>
        <div style="margin:14px 0 26px"><div class="qr-box">${qr}</div></div>
        <p class="qr-note">${state.settings.qr_note || "QR ini masih dummy untuk prototype."}</p>
        <div style="display:flex;gap:10px;max-width:420px;margin:0 auto">
          <button class="btn-ghost" data-close style="flex:1">Nanti dulu</button>
          <button class="btn-primary" id="qrDone"><span class="material-symbols-rounded">check</span> Sudah Bayar</button>
        </div>
        <p style="color:var(--muted);font-size:.82rem;margin-top:14px">No. Pesanan: <b>#${orderId}</b></p>
      </div>`;
    bindClose($("#coBody"));
    $("#qrDone").addEventListener("click", () => {
      closeOverlay("#coOverlay");
      toast("Terima kasih! Panitia akan konfirmasi lewat WhatsApp.", "ok");
    });
  }

  // QR-like pattern (dummy) — deterministik dari seed
  function makeQrSvg(seed) {
    const N = 29, cell = 8, pad = 0, size = N * cell;
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
    let rects = "";
    const finder = (x, y) => {
      rects += `<rect x="${x*cell}" y="${y*cell}" width="${7*cell}" height="${7*cell}" fill="var(--navy)"/>`;
      rects += `<rect x="${(x+1)*cell}" y="${(y+1)*cell}" width="${5*cell}" height="${5*cell}" fill="#fff"/>`;
      rects += `<rect x="${(x+2)*cell}" y="${(y+2)*cell}" width="${3*cell}" height="${3*cell}" fill="var(--navy)"/>`;
    };
    const inFinder = (x, y) =>
      (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (!inFinder(x, y) && rnd() > 0.5)
          rects += `<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}" fill="var(--navy)"/>`;
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="display:block">
      <rect width="${size}" height="${size}" fill="#fff"/>${rects}
      <rect x="${11*cell}" y="${11*cell}" width="${7*cell}" height="${7*cell}" rx="6" fill="#fff"/>
      <rect x="${12.2*cell}" y="${12.2*cell}" width="${4.6*cell}" height="${4.6*cell}" rx="8" fill="var(--yellow)"/>
    </svg>`;
  }

  /* ---------- Request ---------- */
  function bindRequest() {
    $("#openRequest").addEventListener("click", () => openOverlay("#reqOverlay"));
    $("#reqUploadBox").addEventListener("click", () => $("#reqUpload").click());
    $("#reqUpload").addEventListener("change", e => readImage(e.target.files[0], url => {
      state._reqDesign = url; const img = $("#reqPreview"); img.src = url; img.hidden = false;
    }));
    $("#reqSubmit").addEventListener("click", async () => {
      const item = $("#reqItem").value.trim();
      if (!item) return toast("Nama barang wajib diisi", "err");
      const payload = {
        item_name: item, variant: $("#reqVariant").value.trim(),
        quantity: +$("#reqQty").value || 1, note: $("#reqNote").value.trim(),
        name: $("#reqName").value.trim(), whatsapp: $("#reqWa").value.trim(),
        design: state._reqDesign || "",
      };
      try {
        const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) return toast(data.error || "Gagal kirim request", "err");
        toast(data.message || "Request terkirim!", "ok");
        closeOverlay("#reqOverlay");
        ["#reqItem", "#reqVariant", "#reqNote", "#reqName", "#reqWa"].forEach(s => $(s).value = "");
        $("#reqQty").value = 1; $("#reqPreview").hidden = true; state._reqDesign = "";
      } catch { toast("Server tidak merespon", "err"); }
    });
  }

  /* ---------- Contacts ---------- */
  function renderContacts() {
    const s = state.settings;
    const wa = (s.contact_whatsapp || "").replace(/\D/g, "");
    const cards = [
      { ico: "chat", title: "WhatsApp", val: s.contact_whatsapp || "-", href: wa ? `https://wa.me/${wa}` : null },
      { ico: "mail", title: "Email", val: s.contact_email || "-", href: s.contact_email ? `mailto:${s.contact_email}` : null },
      { ico: "photo_camera", title: "Instagram", val: s.contact_instagram || "-", href: null },
      { ico: "person", title: "Contact Person", val: s.contact_person || "Panitia", href: null },
    ];
    $("#contactGrid").innerHTML = cards.map(c => `
      <div class="contact-card">
        <div class="ico"><span class="material-symbols-rounded">${c.ico}</span></div>
        <h3>${c.title}</h3>
        ${c.href ? `<a href="${c.href}" target="_blank" rel="noopener">${c.val}</a>` : `<span>${c.val}</span>`}
      </div>`).join("");
  }

  /* ---------- Overlay / Drawer helpers ---------- */
  function openOverlay(sel)  { $(sel).classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeOverlay(sel) { $(sel).classList.remove("open"); if (!$$(".overlay.open").length && !$("#cartDrawer").classList.contains("open")) document.body.style.overflow = ""; }
  function bindClose(root)   { $$("[data-close]", root).forEach(b => b.addEventListener("click", () => closeOverlay(b.closest(".overlay") ? "#" + b.closest(".overlay").id : "#coOverlay"))); }
  function openDrawer()  { renderCart(); $("#cartDrawer").classList.add("open"); $("#drawerOverlay").classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeDrawer() { $("#cartDrawer").classList.remove("open"); $("#drawerOverlay").classList.remove("open"); if (!$$(".overlay.open").length) document.body.style.overflow = ""; }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
    $$(".reveal").forEach(el => io.observe(el));
  }

  /* ---------- Search & filter ---------- */
  let searchTimer;
  function doSearch(q) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = q.trim(); loadProducts(); }, 220);
  }

  /* ---------- Init ---------- */
  function bindGlobal() {
    // nav
    $("#burger").addEventListener("click", () => $("#navLinks").classList.toggle("show"));
    $$("#navLinks a").forEach(a => a.addEventListener("click", () => $("#navLinks").classList.remove("show")));
    // cart
    $("#cartBtn").addEventListener("click", openDrawer);
    $("#cartClose").addEventListener("click", closeDrawer);
    $("#drawerOverlay").addEventListener("click", closeDrawer);
    // overlays close
    $$(".overlay").forEach(o => {
      o.addEventListener("click", e => { if (e.target === o) closeOverlay("#" + o.id); });
      $$("[data-close]", o).forEach(b => b.addEventListener("click", () => closeOverlay("#" + o.id)));
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { $$(".overlay.open").forEach(o => closeOverlay("#" + o.id)); closeDrawer(); }
    });
    // search
    $("#heroSearch").addEventListener("input", e => { $("#catalogSearch").value = e.target.value; doSearch(e.target.value); });
    $("#heroSearchBtn").addEventListener("click", () => { document.querySelector("#katalog").scrollIntoView({ behavior: "smooth" }); });
    $("#catalogSearch").addEventListener("input", e => doSearch(e.target.value));
    $("#catalogClear").addEventListener("click", () => { $("#catalogSearch").value = ""; $("#heroSearch").value = ""; state.q = ""; loadProducts(); });
    // filters
    $$("#filters .filter").forEach(b => b.addEventListener("click", () => {
      $$("#filters .filter").forEach(x => x.classList.remove("active")); b.classList.add("active");
      state.cat = b.dataset.cat; loadProducts();
    }));
    // footer jump
    $$("[data-jump]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault(); const cat = a.dataset.jump;
      $$("#filters .filter").forEach(x => x.classList.toggle("active", x.dataset.cat === cat));
      state.cat = cat; loadProducts();
      document.querySelector("#katalog").scrollIntoView({ behavior: "smooth" });
    }));
    $("#year").textContent = new Date().getFullYear();
  }

  async function init() {
    bindGlobal(); bindRequest(); initReveal();
    await loadSettings();
    await loadAll();
    await loadProducts();
    bumpCart();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
