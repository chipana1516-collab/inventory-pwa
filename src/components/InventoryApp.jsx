import React, { useEffect, useRef, useState } from "react";

export default function InventoryApp() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ code: "", name: "", price: "" });
  const [openRegister, setOpenRegister] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  // --------------------------
  // Cargar todos los productos
  // --------------------------
  const loadAllProducts = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("product:"));
    const list = keys.map(k => JSON.parse(localStorage.getItem(k)));
    return list.sort((a, b) => a.code.localeCompare(b.code));
  };

  // --------------------------
  // Buscar
  // --------------------------
  const handleSearch = (value) => {
    setSearch(value);
    if (!value || value.trim() === "") {
      setProducts([]);
      return;
    }
    const all = loadAllProducts();
    const filtered = all.filter(p =>
      (p.code || "").toLowerCase().includes(value.toLowerCase()) ||
      (p.name || "").toLowerCase().includes(value.toLowerCase())
    );
    setProducts(filtered);
  };

  // --------------------------
  // Registrar producto
  // --------------------------
  const updateField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const addProduct = () => {
    if (!form.code || !form.name || !form.price) return alert("Completa los campos");
    const p = { code: form.code, name: form.name, price: parseFloat(form.price) };
    localStorage.setItem(`product:${p.code}`, JSON.stringify(p));
    setForm({ code: "", name: "", price: "" });
    alert("Producto guardado ✅");
    if (search.trim()) handleSearch(search);
  };

  // --------------------------
  // Limpiar inventario
  // --------------------------
  const clearInventory = () => {
    if (!confirm("¿Deseas eliminar TODO el inventario?")) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith("product:"))
      .forEach(k => localStorage.removeItem(k));
    setProducts([]);
    setSearch("");
    alert("Inventario eliminado ✅");
  };

  // --------------------------
  // Import CSV (sobrescribe todo)
  // --------------------------
  const importCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Esto eliminará el inventario actual antes de importar. Continuar?")) return;

    // Limpiar inventario
    Object.keys(localStorage)
      .filter(k => k.startsWith("product:"))
      .forEach(k => localStorage.removeItem(k));

    try {
      const txt = await file.text();
      const lines = txt.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase());
      const ci = headers.findIndex(h => h.includes("codigo") || h.includes("code"));
      const ni = headers.findIndex(h => h.includes("nombre") || h.includes("name"));
      const pi = headers.findIndex(h => h.includes("precio") || h.includes("price"));
      if (ci === -1 || ni === -1 || pi === -1) return alert("CSV: columnas codigo,nombre,precio");

      let imported = 0, errors = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;\t]/).map(c => c.replace(/^['"]|['"]$/g,'').trim());
        const code = cols[ci], name = cols[ni], raw = cols[pi];
        const price = parseFloat((raw||'').replace(/[^\d.-]/g,''));
        if (!code || !name || isNaN(price)) { errors++; continue; }
        try { localStorage.setItem(`product:${code}`, JSON.stringify({ code, name, price })); imported++; } catch { errors++; }
      }
      alert(`Importación: ${imported} OK, ${errors} errores`);
      if (search.trim()) handleSearch(search);
    } catch {
      alert("Error leyendo CSV");
    } finally {
      e.target.value = "";
    }
  };

  // --------------------------
  // Export CSV
  // --------------------------
  const exportCSV = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("product:"));
    if (keys.length === 0) return alert("No hay productos");
    let csv = "codigo,nombre,precio\n";
    keys.forEach(k => {
      const p = JSON.parse(localStorage.getItem(k));
      csv += `"${p.code}","${p.name}",${p.price}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventario.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // --------------------------
  // Scanner (BarcodeDetector / Quagga)
  // --------------------------
  useEffect(() => { return () => stopScanner(); }, []);
  const startScanner = async () => {
    setShowScanner(true);
    const hasNative = ('BarcodeDetector' in window);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }

      if (hasNative) {
        const formats = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : ["ean_13","code_128","code_39","upc_a","itf"];
        const detector = new BarcodeDetector({ formats });
        const loop = async () => {
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length) { handleDetected(barcodes[0].rawValue); return; }
          } catch {}
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } else {
        try {
          const Quagga = (await import('quagga')).default || (await import('quagga'));
          Quagga.init({
            inputStream: { type: "LiveStream", target: videoRef.current, constraints: { facingMode: "environment" } },
            decoder: { readers: ["ean_reader","ean_13_reader","code_128_reader","code_39_reader","upc_reader","upc_e_reader"] }
          }, (err) => { if (err) console.error(err); else Quagga.start(); });
          Quagga.onDetected((res) => { const code = res.codeResult && res.codeResult.code; if(code) handleDetected(code); });
        } catch (e) { console.warn("Quagga no disponible", e); }
      }
    } catch (err) {
      alert("No se pudo acceder a la cámara: " + err);
      stopScanner();
    }
  };
  const handleDetected = (code) => { setSearch(code); handleSearch(code); stopScanner(); };
  const stopScanner = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    try { if(window.Quagga && window.Quagga.stop) window.Quagga.stop(); } catch {}
    setShowScanner(false);
  };

  // --------------------------
  // Render
  // --------------------------
  const filtered = products;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-10">
      <div className="max-w-md mx-auto p-4">

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">📦 Inventario</h1>
          <p className="text-gray-500 text-sm">Consulta y gestiona productos</p>
        </div>

        {/* Search block */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por código o nombre..."
            className="w-full pl-4 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3 mt-3">
            <button onClick={() => handleSearch(search)} className="flex-1 bg-green-600 text-white py-3 rounded-lg">🔎 Consultar</button>
            <button onClick={startScanner} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg">📷 Cámara</button>
          </div>
        </div>

        {/* Results */}
        {search.trim() ? (
          filtered.length ? (
            <div className="mb-4 space-y-2">
              {filtered.map((p) => (
                <div key={p.code} className="bg-white rounded-xl shadow p-3 flex justify-between items-center">
                  <div>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{p.code}</span>
                    <h3 className="font-semibold text-gray-800 mt-1">{p.name}</h3>
                    <p className="text-green-600 font-bold">S/ {p.price.toFixed(2)}</p>
                  </div>
                  <button onClick={() => { localStorage.removeItem(`product:${p.code}`); handleSearch(search); }} className="text-red-600 font-bold">✖</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-center text-red-600">No se encontraron productos</div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 mt-4">
            <div className="w-16 h-16 mb-3 rounded-full bg-blue-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="#2563eb" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0a7 7 0 10-9.9-9.9 7 7 0 009.9 9.9z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Busca un producto</h2>
            <p className="text-sm text-gray-500 max-w-xs">Escribe un nombre o código para encontrar productos en tu inventario.</p>
          </div>
        )}

        {/* Import / Export / Clear */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 grid grid-cols-3 gap-3">
          <label className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg cursor-pointer">
            📥 Importar
            <input type="file" accept=".csv" onChange={importCSV} className="hidden" />
          </label>

          <button onClick={exportCSV} className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg">📤 Exportar</button>

          <button onClick={clearInventory} className="bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg">🗑️ Limpiar</button>
        </div>

        {/* Register */}
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <button onClick={() => setOpenRegister(v => !v)} className="w-full flex items-center justify-between">
            <span className="font-semibold">Registrar Producto</span>
            <span>{openRegister ? "▲" : "▼"}</span>
          </button>
          {openRegister && (
            <div className="mt-3">
              <input value={form.code} onChange={(e) => updateField('code', e.target.value)} placeholder="Código" className="w-full border p-2 rounded mb-2" />
              <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Nombre" className="w-full border p-2 rounded mb-2" />
              <input value={form.price} onChange={(e) => updateField('price', e.target.value)} placeholder="Precio" type="number" className="w-full border p-2 rounded mb-3" />
              <button onClick={addProduct} className="w-full bg-blue-600 text-white py-2 rounded">Registrar</button>
            </div>
          )}
        </div>

        {/* Scanner modal */}
        {showScanner && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
            <div className="bg-white rounded-lg p-4 w-[92%] max-w-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Escanear código</h3>
                <button onClick={stopScanner} className="text-red-600">Cerrar</button>
              </div>
              <div className="w-full h-64 bg-black rounded overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover"></video>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-2xl shadow-lg p-4 mt-4 flex justify-between items-center">
          <span className="text-gray-600">Total de productos:</span>
          <span className="text-xl font-bold text-blue-600">{loadAllProducts().length}</span>
        </div>

      </div>
    </div>
  );
}
