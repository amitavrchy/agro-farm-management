export default function HomePage() {
  return (
    <main>
      <h1>Agro / Farm Management</h1>
      <p className="sub">
        Small and commercial farms, cooperatives, contract farming, and multi-farm organizations.
        Crops, livestock, dairy, poultry, aquaculture, and horticulture — plus a vendor marketplace.
      </p>
      <p className="sub">খামার ব্যবস্থাপনা ও ভেন্ডর মার্কেটপ্লেস (বাংলা / English).</p>
      <div className="grid">
        <div className="card">Field mapping, crop cycles, livestock tags</div>
        <div className="card">Health, feed, IoT, weather, yield forecast</div>
        <div className="card">P&amp;L, cooperatives, loans, offline field app</div>
        <div className="card">Vets, inputs, equipment rental, buyers, payments</div>
      </div>
      <p className="sub">Implementation follows Project_spec.md. API health: /api/health on port 4220.</p>
    </main>
  );
}
