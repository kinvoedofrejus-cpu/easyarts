const PrintDocs = (() => {
  function openWindow(html) {
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  function wrap(title, bodyHtml) {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${title}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;padding:40px;max-width:750px;margin:0 auto;}
      .doc-header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #6c3ce0;padding-bottom:16px;margin-bottom:28px;}
      .doc-header h1{margin:0;font-size:22px;}
      .doc-header .center-info{font-size:12px;color:#555;text-align:right;line-height:1.5;}
      .doc-title{text-align:center;font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:24px 0;color:#12112b;}
      .doc-number{text-align:center;font-size:13px;color:#777;margin-bottom:24px;}
      table{width:100%;border-collapse:collapse;margin:20px 0;}
      td{padding:10px 6px;border-bottom:1px solid #eee;font-size:14px;}
      td.label{color:#777;width:40%;}
      .amount-box{background:#f4f5fb;border-radius:10px;padding:18px;text-align:center;margin:24px 0;}
      .amount-box .amt{font-size:26px;font-weight:800;color:#6c3ce0;}
      .cert-body{text-align:center;line-height:2;font-size:15px;margin:30px 0;}
      .cert-body .name{font-size:22px;font-weight:800;color:#12112b;}
      .signatures{display:flex;justify-content:space-between;margin-top:60px;font-size:13px;}
      .print-btn{margin-top:30px;text-align:center;}
      .print-btn button{padding:10px 24px;border-radius:8px;border:none;background:#6c3ce0;color:#fff;font-weight:700;cursor:pointer;}
      @media print{.print-btn{display:none;}}
    </style></head><body>${bodyHtml}
    <div class="print-btn"><button onclick="window.print()">🖨️ Imprimer</button></div>
    </body></html>`;
  }

  function centerBlock(center) {
    return `<div class="doc-header">
      <h1>${center.name || "EasyArts"}</h1>
      <div class="center-info">${center.address || ""}<br>${center.phone || ""}${center.email ? " · " + center.email : ""}</div>
    </div>`;
  }

  function receipt(data) {
    const { center, payment } = data;
    const html = `${centerBlock(center)}
      <div class="doc-title">Quittance de paiement</div>
      <div class="doc-number">N° ${payment.receipt_number} — ${new Date(payment.pay_date).toLocaleDateString("fr-FR")}</div>
      <table>
        <tr><td class="label">Élève / Artiste</td><td>${payment.first_name} ${payment.last_name} (${payment.matricule || "—"})</td></tr>
        <tr><td class="label">Mode de paiement</td><td>${payment.method}</td></tr>
        <tr><td class="label">Motif</td><td>${payment.description || "Frais de formation"}</td></tr>
      </table>
      <div class="amount-box"><div style="font-size:12px;color:#777;">Montant reçu</div><div class="amt">${Number(payment.amount).toLocaleString("fr-FR")} ${center.currency || "FCFA"}</div></div>
      <div class="signatures"><div>Signature du caissier</div><div>Cachet du centre</div></div>`;
    openWindow(wrap("Quittance " + payment.receipt_number, html));
  }

  function enrollment(data) {
    const { center, student } = data;
    const html = `${centerBlock(center)}
      <div class="doc-title">Fiche d'inscription</div>
      <div class="doc-number">Matricule : ${student.matricule || "—"}</div>
      <table>
        <tr><td class="label">Nom complet</td><td>${student.first_name} ${student.last_name}</td></tr>
        <tr><td class="label">Date de naissance</td><td>${student.birth_date ? new Date(student.birth_date).toLocaleDateString("fr-FR") : "—"}</td></tr>
        <tr><td class="label">Sexe</td><td>${student.gender || "—"}</td></tr>
        <tr><td class="label">Téléphone</td><td>${student.phone || "—"}</td></tr>
        <tr><td class="label">Parent / Tuteur</td><td>${student.parent_name || "—"} (${student.parent_phone || "—"})</td></tr>
        <tr><td class="label">Adresse</td><td>${student.address || "—"}</td></tr>
        <tr><td class="label">Discipline</td><td>${student.discipline_name || "—"}</td></tr>
        <tr><td class="label">Date d'inscription</td><td>${new Date(student.enrollment_date).toLocaleDateString("fr-FR")}</td></tr>
      </table>
      <div class="signatures"><div>Signature du parent/tuteur</div><div>Signature de l'administration</div></div>`;
    openWindow(wrap("Fiche d'inscription", html));
  }

  function certificate(data) {
    const { center, certificate } = data;
    const labels = { fin_stage: "Attestation de fin de stage", fin_formation: "Attestation de fin de formation", participation: "Attestation de participation", autre: certificate.title || "Attestation" };
    const html = `${centerBlock(center)}
      <div class="doc-title">${labels[certificate.cert_type] || "Attestation"}</div>
      <div class="doc-number">N° ${certificate.cert_number}</div>
      <div class="cert-body">
        Le Directeur du centre <strong>${center.name}</strong> atteste que<br>
        <span class="name">${certificate.first_name} ${certificate.last_name}</span><br>
        (Matricule : ${certificate.matricule || "—"})<br>
        a suivi avec succès sa formation au sein de notre centre.<br>
        Délivrée le ${new Date(certificate.issue_date).toLocaleDateString("fr-FR")} pour servir et valoir ce que de droit.
      </div>
      <div class="signatures"><div></div><div>Le Directeur<br>${center.director_name || ""}</div></div>`;
    openWindow(wrap(labels[certificate.cert_type], html));
  }

  return { receipt, enrollment, certificate };
})();
