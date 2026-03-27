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

  .title-wrap {
    position: relative;
    min-height: 118px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .title {
    text-align: center;
    font-size: 34px;
    line-height: 1.08;
    letter-spacing: 0.02em;
    font-weight: 800;
    color: var(--navy);
    margin: 0 auto;
    text-transform: uppercase;
  }

  .verified-stamp {
    position: absolute;
    top: 2px;
    right: 0;
    width: 126px;
    height: 126px;
    border-radius: 999px;
    border: 4px solid rgba(89, 193, 104, 0.9);
    background: rgba(89, 193, 104, 0.08);
    color: #2e7d32;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    transform: rotate(-10deg);
    padding: 12px;
  }

  .verified-stamp-title {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .verified-stamp-subtitle,
  .verified-stamp-date {
    font-size: 11px;
    line-height: 1.25;
    font-weight: 700;
  }

  .top-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 9px 12px;
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
    gap: 20px;
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
    font-size: 20px;
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
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .score-bands .severe { color: var(--coral); }
  .score-bands .concerning { color: #f09d58; }
  .score-bands .moderate { color: #d7a14a; }
  .score-bands .good { color: #73c46d; }
  .score-bands .excellent { color: var(--green); }

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
    font-size: 19px;
    line-height: 1.05;
    font-weight: 800;
    text-transform: uppercase;
  }

  .section-header.blue { background: var(--navy); }
  .section-header.coral { background: var(--coral); }
  .section-header.green { background: var(--green); }

  .section-content {
    padding: 16px 18px 18px 18px;
    font-size: 17px;
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
    font-size: 19px;
  }

  .placeholder {
    color: var(--muted);
    font-style: italic;
  }

  .routine-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
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
    font-size: 19px;
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

    .report-page:first-of-type {
      padding: 16px 14px 14px 14px;
    }

    .report-page:first-of-type .title-wrap {
      min-height: 104px;
      margin-bottom: 8px;
    }

    .report-page:first-of-type .title {
      font-size: 28px;
      margin: 0 auto;
    }

    .report-page:first-of-type .verified-stamp {
      width: 102px;
      height: 102px;
      border-width: 3px;
      top: 0;
      padding: 10px;
    }

    .report-page:first-of-type .verified-stamp-title {
      font-size: 10.5px;
    }

    .report-page:first-of-type .verified-stamp-subtitle,
    .report-page:first-of-type .verified-stamp-date {
      font-size: 8.5px;
    }

    .report-page:first-of-type .top-grid {
      gap: 5px 6px;
      margin-bottom: 10px;
    }

    .report-page:first-of-type .pill-label {
      min-width: 74px;
      padding: 5px 8px;
      font-size: 10.5px;
    }

    .report-page:first-of-type .pill-value {
      padding: 5px 8px;
      font-size: 11.5px;
    }

    .report-page:first-of-type .images {
      gap: 10px;
      margin: 10px 0 8px 0;
    }

    .report-page:first-of-type .image-slot {
      width: 154px;
      height: 154px;
      border-width: 4px;
    }

    .report-page:first-of-type .score-wrap {
      margin: 4px auto 10px auto;
      padding: 10px 14px 12px 14px;
    }

    .report-page:first-of-type .score-label {
      font-size: 15px;
      margin-bottom: 4px;
    }

    .report-page:first-of-type .score-point {
      font-size: 12px;
    }

    .report-page:first-of-type .score-point span {
      width: 24px;
      height: 24px;
    }

    .report-page:first-of-type .score-bands {
      font-size: 8.5px;
      gap: 4px;
    }

    .report-page:first-of-type .panel-grid {
      gap: 10px;
      margin-top: 6px;
    }

    .report-page:first-of-type .columns {
      gap: 8px;
    }

    .report-page:first-of-type .section-header {
      padding: 8px 14px;
      font-size: 15px;
    }

    .report-page:first-of-type .section-content {
      padding: 10px 14px 12px 14px;
      font-size: 13.2px;
      line-height: 1.3;
    }

    .report-page:first-of-type .meta-list li,
    .report-page:first-of-type .product-item {
      margin-bottom: 2px;
    }

    .report-page:first-of-type .product-item {
      font-size: 13.2px;
      line-height: 1.28;
    }

    .report-page:first-of-type .product-item strong {
      font-size: 15px;
    }

    .report-page:nth-of-type(2) {
      padding-top: 20px;
      padding-bottom: 108px;
    }

    .report-page:nth-of-type(2) .title {
      margin-bottom: 10px;
      font-size: 32px;
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
      font-size: 16.5px;
    }

    .report-page:nth-of-type(2) .section-content {
      padding: 12px 16px 14px 16px;
      font-size: 14.8px;
      line-height: 1.42;
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
