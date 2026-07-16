<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kebijakan Privasi – KomiKam</title>
    <meta name="description" content="Kebijakan Privasi aplikasi KomiKam. Pelajari bagaimana kami mengumpulkan, menggunakan, dan melindungi data pribadi Anda.">
    <meta name="robots" content="index, follow">

    <!-- Open Graph -->
    <meta property="og:title" content="Kebijakan Privasi – KomiKam">
    <meta property="og:description" content="Kebijakan Privasi aplikasi KomiKam. Pelajari bagaimana kami melindungi data Anda.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{{ url('/privacy-policy') }}">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

    <style>
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        :root {
            --bg:           #0B0B0E;
            --surface:      #121218;
            --surface-2:    #1A1A24;
            --border:       #242434;
            --accent:       #4A8FE2;
            --accent-glow:  rgba(74, 143, 226, 0.15);
            --text:         #F2F2F7;
            --subtext:      #B3B3C2;
            --muted:        #6B6B80;
            --gold:         #F4B942;
        }

        html { scroll-behavior: smooth; }

        body {
            font-family: 'Inter', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.7;
            min-height: 100vh;
        }

        /* ── Header ── */
        header {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(18, 18, 24, 0.85);
            backdrop-filter: blur(20px) saturate(1.5);
            -webkit-backdrop-filter: blur(20px) saturate(1.5);
            border-bottom: 1px solid var(--border);
        }

        .header-inner {
            max-width: 860px;
            margin: 0 auto;
            padding: 0 24px;
            height: 64px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-badge {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: linear-gradient(135deg, #4A8FE2, #7B4FE0);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
            box-shadow: 0 0 16px rgba(74,143,226,0.3);
        }

        .site-name {
            font-size: 18px;
            font-weight: 800;
            background: linear-gradient(90deg, #4A8FE2, #A78BFA);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        /* ── Hero ── */
        .hero {
            position: relative;
            overflow: hidden;
            padding: 72px 24px 60px;
            text-align: center;
        }

        .hero::before {
            content: '';
            position: absolute;
            top: -80px;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            height: 400px;
            background: radial-gradient(ellipse at center, rgba(74,143,226,0.12) 0%, transparent 70%);
            pointer-events: none;
        }

        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--accent-glow);
            border: 1px solid rgba(74,143,226,0.3);
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 12px;
            font-weight: 600;
            color: var(--accent);
            margin-bottom: 20px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        .hero h1 {
            font-size: clamp(28px, 5vw, 42px);
            font-weight: 900;
            line-height: 1.15;
            margin-bottom: 16px;
            background: linear-gradient(160deg, #F2F2F7 40%, #B3B3C2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .hero-meta {
            font-size: 13px;
            color: var(--muted);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        /* ── TOC ── */
        .toc-wrap {
            max-width: 860px;
            margin: 0 auto 48px;
            padding: 0 24px;
        }

        .toc {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px 28px;
        }

        .toc-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--muted);
            margin-bottom: 14px;
        }

        .toc ol {
            list-style: none;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 10px;
        }

        .toc ol li a {
            color: var(--accent);
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            transition: opacity 0.15s;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .toc ol li a:hover { opacity: 0.7; }

        .toc ol li a .num {
            background: var(--surface-2);
            border: 1px solid var(--border);
            color: var(--muted);
            font-size: 10px;
            font-weight: 700;
            width: 22px;
            height: 22px;
            border-radius: 6px;
            display: grid;
            place-items: center;
            flex-shrink: 0;
        }

        /* ── Main content ── */
        main {
            max-width: 860px;
            margin: 0 auto;
            padding: 0 24px 80px;
        }

        .section {
            margin-bottom: 28px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 32px;
            position: relative;
            transition: border-color 0.2s;
        }

        .section:hover {
            border-color: rgba(74,143,226,0.25);
        }

        .section-num {
            position: absolute;
            top: 20px;
            right: 24px;
            font-size: 52px;
            font-weight: 900;
            color: var(--surface-2);
            line-height: 1;
            user-select: none;
        }

        .section h2 {
            font-size: 18px;
            font-weight: 800;
            color: var(--text);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section-icon {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: var(--accent-glow);
            border: 1px solid rgba(74,143,226,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }

        .section p {
            font-size: 14px;
            color: var(--subtext);
            line-height: 1.8;
            margin-bottom: 12px;
        }

        .section p:last-child { margin-bottom: 0; }

        .bullet-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 12px;
        }

        .bullet-list li {
            display: flex;
            gap: 12px;
            font-size: 14px;
            color: var(--subtext);
            line-height: 1.75;
        }

        .bullet-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--accent);
            flex-shrink: 0;
            margin-top: 9px;
        }

        .bullet-list strong {
            color: var(--text);
            font-weight: 600;
        }

        /* ── Info card ── */
        .info-card {
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-left: 3px solid var(--accent);
            border-radius: 12px;
            padding: 14px 18px;
            margin-top: 16px;
            font-size: 13px;
            color: var(--subtext);
            line-height: 1.7;
        }

        .info-card.gold { border-left-color: var(--gold); }

        /* ── Chips ── */
        .chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 16px;
        }

        .chip {
            background: var(--surface-2);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 5px 14px;
            font-size: 12px;
            font-weight: 600;
            color: var(--subtext);
        }

        /* ── Contact ── */
        .contact-box {
            background: linear-gradient(135deg, rgba(74,143,226,0.08), rgba(123,79,224,0.08));
            border: 1px solid rgba(74,143,226,0.2);
            border-radius: 20px;
            padding: 36px;
            text-align: center;
            margin-bottom: 28px;
        }

        .contact-box h3 {
            font-size: 20px;
            font-weight: 800;
            margin-bottom: 10px;
        }

        .contact-box p {
            font-size: 14px;
            color: var(--subtext);
            max-width: 500px;
            margin: 0 auto 24px;
            line-height: 1.75;
        }

        .contact-email {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: var(--accent);
            color: #fff;
            font-weight: 700;
            font-size: 14px;
            text-decoration: none;
            padding: 13px 28px;
            border-radius: 12px;
            transition: opacity 0.2s, transform 0.2s;
        }

        .contact-email:hover {
            opacity: 0.85;
            transform: translateY(-2px);
        }

        /* ── Footer ── */
        footer {
            border-top: 1px solid var(--border);
            padding: 32px 24px;
            text-align: center;
        }

        .footer-inner { max-width: 860px; margin: 0 auto; }

        .footer-logo {
            font-size: 20px;
            font-weight: 900;
            background: linear-gradient(90deg, #4A8FE2, #A78BFA);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
        }

        .footer-copy {
            font-size: 12px;
            color: var(--muted);
        }

        .footer-copy a {
            color: var(--muted);
            text-decoration: none;
        }

        /* ── Responsive ── */
        @media (max-width: 600px) {
            .section { padding: 22px 18px; }
            .section-num { display: none; }
            .toc ol { grid-template-columns: 1fr; }
            .hero { padding: 48px 20px 40px; }
            .contact-box { padding: 24px 20px; }
        }
    </style>
</head>
<body>

    <!-- ── Header ── -->
    <header>
        <div class="header-inner">
            <div class="logo-badge">📚</div>
            <span class="site-name">KomiKam</span>
        </div>
    </header>

    <!-- ── Hero ── -->
    <div class="hero">
        <div class="hero-badge">🔐 Dokumen Legal</div>
        <h1>Kebijakan Privasi</h1>
        <div class="hero-meta">
            <span>📅 Terakhir diperbarui: 30 Juni 2026</span>
            <span>🌐 Berlaku untuk: Aplikasi Android &amp; Web KomiKam</span>
        </div>
    </div>

    <!-- ── Table of Contents ── -->
    <div class="toc-wrap">
        <div class="toc">
            <div class="toc-title">📋 Daftar Isi</div>
            <ol>
                <li>
                    <a href="#s1"><span class="num">1</span>Informasi yang Kami Kumpulkan</a>
                </li>
                <li>
                    <a href="#s2"><span class="num">2</span>Penggunaan Informasi</a>
                </li>
                <li>
                    <a href="#s3"><span class="num">3</span>Keamanan Data</a>
                </li>
                <li>
                    <a href="#s4"><span class="num">4</span>Hak Pengguna atas Data</a>
                </li>
                <li>
                    <a href="#s5"><span class="num">5</span>Konten Pihak Ketiga</a>
                </li>
                <li>
                    <a href="#s6"><span class="num">6</span>Perubahan Kebijakan</a>
                </li>
                <li>
                    <a href="#s7"><span class="num">7</span>Kontak Kami</a>
                </li>
            </ol>
        </div>
    </div>

    <!-- ── Sections ── -->
    <main>

        <div class="section" id="s1">
            <div class="section-num">01</div>
            <h2>
                <div class="section-icon">📦</div>
                Informasi yang Kami Kumpulkan
            </h2>
            <p>Kami mengumpulkan informasi secara minimal untuk menyediakan fungsionalitas aplikasi yang optimal dan terpersonalisasi.</p>
            <ul class="bullet-list">
                <li>
                    <div class="bullet-dot"></div>
                    <div><strong>Informasi Akun:</strong> Nama pengguna, alamat email, dan kata sandi yang dienkripsi saat Anda mendaftar akun KomiKam.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div><strong>Aktivitas Membaca:</strong> Riwayat membaca (History), daftar Bookmark, dan komentar Anda. Data ini disinkronisasikan ke server jika Anda masuk (login) agar dapat diakses di berbagai perangkat.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div><strong>Data Unduhan:</strong> Komik yang Anda unduh disimpan secara lokal di penyimpanan perangkat Anda dan <strong>tidak</strong> dikirimkan ke server kami.</div>
                </li>
            </ul>
            <div class="info-card">
                💡 <strong>Catatan:</strong> Anda dapat menjelajahi katalog komik tanpa mendaftar akun. Pendaftaran hanya diperlukan untuk fitur Bookmark, History, dan Download berbasis cloud.
            </div>
        </div>

        <div class="section" id="s2">
            <div class="section-num">02</div>
            <h2>
                <div class="section-icon">⚙️</div>
                Penggunaan Informasi
            </h2>
            <p>Informasi yang kami kumpulkan digunakan hanya untuk keperluan berikut:</p>
            <ul class="bullet-list">
                <li>
                    <div class="bullet-dot"></div>
                    <div>Menyediakan, mengoperasikan, dan memelihara fitur-fitur aplikasi (Bookmark, History, Download).</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div>Menampilkan nama pengguna Anda secara aman saat mengirimkan komentar di ulasan komik.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div>Meningkatkan kinerja dan pengalaman pengguna aplikasi KomiKam.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div>Mengirimkan notifikasi yang relevan terkait aktivitas akun Anda (jika diaktifkan).</div>
                </li>
            </ul>
            <div class="info-card gold">
                🚫 <strong>Kami tidak akan</strong> menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan pemasaran atau komersial apapun.
            </div>
        </div>

        <div class="section" id="s3">
            <div class="section-num">03</div>
            <h2>
                <div class="section-icon">🔒</div>
                Keamanan Data
            </h2>
            <p>Kami menerapkan langkah-langkah keamanan teknis dan organisasi untuk melindungi informasi Anda:</p>
            <ul class="bullet-list">
                <li>
                    <div class="bullet-dot"></div>
                    <div><strong>Enkripsi Transit:</strong> Semua komunikasi antara aplikasi dan server backend menggunakan protokol HTTPS dengan enkripsi SSL/TLS.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div><strong>Penyimpanan Token Aman:</strong> Token autentikasi di perangkat mobile Anda dilindungi menggunakan penyimpanan aman tingkat hardware (SecureStore).</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div><strong>Enkripsi Kata Sandi:</strong> Kata sandi Anda disimpan dalam bentuk hash yang tidak dapat dibalikkan menggunakan algoritma bcrypt.</div>
                </li>
            </ul>
            <div class="chip-row">
                <span class="chip">🔑 HTTPS / SSL</span>
                <span class="chip">🔐 SecureStore</span>
                <span class="chip">🛡️ Bcrypt Hashing</span>
                <span class="chip">📡 Enkripsi Transit</span>
            </div>
        </div>

        <div class="section" id="s4">
            <div class="section-num">04</div>
            <h2>
                <div class="section-icon">👤</div>
                Hak Pengguna atas Data
            </h2>
            <p>Anda memiliki kontrol penuh atas data Anda sendiri di platform KomiKam:</p>
            <ul class="bullet-list">
                <li>
                    <div class="bullet-dot"></div>
                    <div>Anda dapat menghapus data riwayat membaca (History) kapan saja melalui pengaturan akun.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div>Anda dapat menghapus komentar atau balasan yang Anda buat secara mandiri melalui tombol hapus di samping komentar Anda.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div>Anda dapat membaca dan menjelajahi katalog komik tanpa melakukan pendaftaran akun.</div>
                </li>
                <li>
                    <div class="bullet-dot"></div>
                    <div>Anda dapat mengajukan permintaan penghapusan akun beserta seluruh data terkait dengan menghubungi tim kami melalui email.</div>
                </li>
            </ul>
        </div>

        <div class="section" id="s5">
            <div class="section-num">05</div>
            <h2>
                <div class="section-icon">🌐</div>
                Konten Pihak Ketiga
            </h2>
            <p>Aplikasi KomiKam menampilkan konten komik yang bersumber dari penyedia pihak ketiga. Konten tersebut merupakan milik penyedia masing-masing dan tunduk pada kebijakan privasi mereka sendiri.</p>
            <p>Kami tidak bertanggung jawab atas praktik privasi situs web atau layanan pihak ketiga yang mungkin terhubung melalui aplikasi kami. Kami menyarankan Anda untuk membaca kebijakan privasi dari setiap layanan yang Anda gunakan.</p>
        </div>

        <div class="section" id="s6">
            <div class="section-num">06</div>
            <h2>
                <div class="section-icon">🔄</div>
                Perubahan Kebijakan
            </h2>
            <p>Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Setiap perubahan signifikan akan diberitahukan melalui pembaruan aplikasi atau notifikasi di dalam aplikasi.</p>
            <p>Tanggal "Terakhir Diperbarui" di bagian atas halaman ini akan selalu mencerminkan versi terkini dari kebijakan kami. Penggunaan berkelanjutan terhadap aplikasi setelah perubahan berarti Anda menyetujui kebijakan yang diperbarui.</p>
        </div>

        <!-- Contact -->
        <div class="contact-box" id="s7">
            <h3>💬 Hubungi Kami</h3>
            <p>Jika Anda memiliki pertanyaan, kekhawatiran, atau permintaan terkait Kebijakan Privasi ini atau pengelolaan data pribadi Anda, silakan hubungi tim pengembang KomiKam:</p>
            <a href="mailto:admin@komikam.sir-l.web.id" class="contact-email">
                ✉️ &nbsp;admin@komikam.sir-l.web.id
            </a>
        </div>

    </main>

    <!-- ── Footer ── -->
    <footer>
        <div class="footer-inner">
            <div class="footer-logo">KomiKam</div>
            <p class="footer-copy">© 2026 KomiKam · All Rights Reserved · <a href="/privacy-policy">Kebijakan Privasi</a></p>
        </div>
    </footer>

</body>
</html>
