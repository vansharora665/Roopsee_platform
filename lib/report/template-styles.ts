export const reportTemplateStyles = `
  :root {
    --navy: #5473b7;
    --navy-dark: #27426d;
    --coral: #f2665a;
    --green: #59c168;
    --sand: #fffaf3;
    --ink: #182635;
    --muted: #66758a;
    --line: #d8dfeb;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
  }

  body {
    background: linear-gradient(180deg, #fffdf9 0%, #f8f0e6 100%);
    color: var(--ink);
    font-family: "Avenir Next", "Segoe UI", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-root {
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    padding: 18px;
  }

  .report-page {
    position: relative;
    width: 794px;
    min-height: 1122px;
    margin: 0 auto 16px auto;
    padding: 24px 22px;
    background: white;
    border-radius: 24px;
    box-shadow: 0 16px 40px rgba(39, 66, 109, 0.08);
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }

  .report-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .title {
    text-align: center;
    font-size: 32px;
    line-height: 1.1;
    letter-spacing: 0.02em;
    font-weight: 800;
    color: var(--navy);
    margin-bottom: 12px;
    text-transform: uppercase;
  }

  .top-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px 10px;
    margin-bottom: 18px;
  }

  .pill {
    display: flex;
    align-items: center;
    overflow: hidden;
    border-radius: 999px;
    border: 2px solid rgba(84, 115, 183, 0.16);
    background: #edf2ff;
  }

  .pill-label {
    min-width: 88px;
    padding: 7px 12px;
    background: #d8e6ff;
    color: var(--navy-dark);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .pill-value {
    padding: 7px 12px;
    font-size: 13px;
    font-weight: 700;
    color: var(--navy-dark);
  }

  .images {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    justify-items: center;
    margin: 18px 0 14px 0;
  }

  .image-slot {
    width: 168px;
    height: 168px;
    border-radius: 999px;
    border: 5px solid var(--navy);
    overflow: hidden;
    background: linear-gradient(180deg, #e7f4ff 0%, #f7fbff 56%, #e5f4d1 57%, #a8c03a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-slot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-placeholder {
    text-align: center;
    color: var(--navy-dark);
    font-size: 13px;
    font-weight: 700;
    padding: 24px;
  }

  .score-wrap {
    margin: 8px auto 16px auto;
    padding: 14px 18px 16px 18px;
    border: 2px solid rgba(24, 38, 53, 0.2);
    border-radius: 999px;
  }

  .score-label {
    text-align: center;
    font-size: 18px;
    font-weight: 800;
    color: var(--navy-dark);
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .score-line {
    position: relative;
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 0;
    align-items: center;
    margin-bottom: 8px;
  }

  .score-line::before {
    content: "";
    position: absolute;
    left: 12px;
    right: 12px;
    top: 18px;
    height: 2px;
    background: #202733;
  }

  .score-point {
    position: relative;
    text-align: center;
    font-size: 14px;
    font-weight: 700;
    color: #b3bfce;
  }

  .score-point span {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: white;
    border: 2px solid transparent;
  }

  .score-point.active span {
    border-color: var(--coral);
    color: var(--coral);
  }

  .score-bands {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    text-align: center;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .score-bands .needs { color: var(--coral); }
  .score-bands .moderate { color: #f09d58; }
  .score-bands .improvement { color: #73c46d; }
  .score-bands .healthy { color: var(--green); }

  .panel-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 10px;
  }

  .section-box {
    border: 2px solid var(--line);
    border-radius: 18px;
    overflow: hidden;
    background: white;
  }

  .section-box.full {
    grid-column: 1 / -1;
  }

  .section-header {
    padding: 12px 18px;
    color: white;
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
    text-transform: uppercase;
  }

  .section-header.blue { background: var(--navy); }
  .section-header.coral { background: var(--coral); }
  .section-header.green { background: var(--green); }

  .section-content {
    padding: 16px 18px 18px 18px;
    font-size: 15px;
    line-height: 1.5;
  }

  .section-content p {
    margin: 0 0 8px 0;
  }

  .section-content p:last-child {
    margin-bottom: 0;
  }

  .meta-list {
    list-style: disc;
    padding-left: 18px;
    margin: 0;
  }

  .meta-list li {
    margin-bottom: 6px;
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .product-item {
    margin-bottom: 10px;
    font-size: 16px;
  }

  .product-item strong {
    font-size: 18px;
  }

  .placeholder {
    color: var(--muted);
    font-style: italic;
  }

  .routine-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    margin-top: 8px;
  }

  .routine-card {
    border: 2px solid #e3eaf6;
    border-radius: 18px;
    padding: 16px;
    background: #fcfdff;
  }

  .routine-card h3 {
    margin: 0 0 10px 0;
    color: var(--navy-dark);
    font-size: 18px;
    text-transform: uppercase;
  }

  .routine-list {
    list-style: decimal;
    padding-left: 20px;
    margin: 0;
  }

  .routine-list li {
    margin-bottom: 8px;
  }

  .footer {
    position: absolute;
    left: 22px;
    right: 22px;
    bottom: 26px;
    border-top: 2px solid #dce4f2;
    padding-top: 14px;
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--muted);
  }

  @page {
    size: 210mm 297mm;
    margin: 0;
  }

  @media print {
    html,
    body {
      width: 210mm;
      background: white;
    }

    .report-root {
      width: 210mm;
      max-width: none;
      margin: 0;
      padding: 0;
    }

    .report-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .report-page:nth-of-type(2) {
      padding-top: 20px;
      padding-bottom: 108px;
    }

    .report-page:nth-of-type(2) .title {
      margin-bottom: 10px;
      font-size: 30px;
    }

    .report-page:nth-of-type(2) .routine-grid {
      gap: 14px;
      margin-top: 4px;
    }

    .report-page:nth-of-type(2) .routine-card {
      padding: 14px;
    }

    .report-page:nth-of-type(2) .panel-grid {
      gap: 12px;
    }

    .report-page:nth-of-type(2) .section-header {
      padding: 10px 16px;
      font-size: 16px;
    }

    .report-page:nth-of-type(2) .section-content {
      padding: 12px 16px 14px 16px;
      font-size: 14px;
      line-height: 1.35;
    }

    .report-page:nth-of-type(2) .meta-list li,
    .report-page:nth-of-type(2) .routine-list li {
      margin-bottom: 4px;
    }

    .report-page:nth-of-type(2) .footer {
      bottom: 18px;
      padding-top: 10px;
      font-size: 12px;
    }
  }
`;
