const SITE = process.env.SITE_URL || "https://kanicasino.com";

// a username is free text, so it is escaped before it goes into the markup
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// the email is in the language the player had the site in when they asked for it
const COPY = {
  en: {
    subject: "Verify your KaniCasino account",
    preview: "Confirm your email to unlock the leaderboard, the market and rain.",
    hi: "Hi, {name}!",
    body: "Confirm this email address to verify your KaniCasino account. Verified accounts can compete on the leaderboard, trade on the market and join the rain.",
    button: "Verify my account",
    expires: "The link works for 24 hours.",
    ignore: "If you did not ask for this, you can ignore this email.",
  },
  pt: {
    subject: "Verifique sua conta da KaniCasino",
    preview: "Confirme seu e-mail para liberar o ranking, o mercado e a chuva.",
    hi: "Olá, {name}!",
    body: "Confirme este endereço de e-mail para verificar sua conta da KaniCasino. Contas verificadas podem competir no ranking, negociar no mercado e participar da chuva.",
    button: "Verificar minha conta",
    expires: "O link funciona por 24 horas.",
    ignore: "Se você não pediu isso, pode ignorar este e-mail.",
  },
  es: {
    subject: "Verifica tu cuenta de KaniCasino",
    preview: "Confirma tu correo para desbloquear la clasificación, el mercado y la lluvia.",
    hi: "¡Hola, {name}!",
    body: "Confirma esta dirección de correo para verificar tu cuenta de KaniCasino. Las cuentas verificadas pueden competir en la clasificación, comerciar en el mercado y unirse a la lluvia.",
    button: "Verificar mi cuenta",
    expires: "El enlace funciona durante 24 horas.",
    ignore: "Si no lo pediste, puedes ignorar este correo.",
  },
  fr: {
    subject: "Vérifiez votre compte KaniCasino",
    preview: "Confirmez votre e-mail pour débloquer le classement, le marché et la pluie.",
    hi: "Bonjour, {name} !",
    body: "Confirmez cette adresse e-mail pour vérifier votre compte KaniCasino. Les comptes vérifiés peuvent concourir au classement, échanger sur le marché et rejoindre la pluie.",
    button: "Vérifier mon compte",
    expires: "Le lien fonctionne pendant 24 heures.",
    ignore: "Si vous n'avez rien demandé, vous pouvez ignorer cet e-mail.",
  },
  de: {
    subject: "Bestätige dein KaniCasino-Konto",
    preview: "Bestätige deine E-Mail, um die Bestenliste, den Markt und den Regen freizuschalten.",
    hi: "Hallo, {name}!",
    body: "Bestätige diese E-Mail-Adresse, um dein KaniCasino-Konto zu verifizieren. Verifizierte Konten können in der Bestenliste antreten, auf dem Markt handeln und beim Regen mitmachen.",
    button: "Mein Konto verifizieren",
    expires: "Der Link funktioniert 24 Stunden lang.",
    ignore: "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.",
  },
  it: {
    subject: "Verifica il tuo account KaniCasino",
    preview: "Conferma la tua email per sbloccare la classifica, il mercato e la pioggia.",
    hi: "Ciao, {name}!",
    body: "Conferma questo indirizzo email per verificare il tuo account KaniCasino. Gli account verificati possono competere in classifica, commerciare nel mercato e partecipare alla pioggia.",
    button: "Verifica il mio account",
    expires: "Il link funziona per 24 ore.",
    ignore: "Se non l'hai richiesto, puoi ignorare questa email.",
  },
  ja: {
    subject: "KaniCasinoアカウントの認証",
    preview: "メールを確認して、ランキング・マーケット・レインを利用できるようにしましょう。",
    hi: "{name}さん、こんにちは！",
    body: "このメールアドレスを確認して、KaniCasinoアカウントを認証してください。認証済みのアカウントはランキングへの参加、マーケットでの取引、レインへの参加ができます。",
    button: "アカウントを認証する",
    expires: "リンクの有効期限は24時間です。",
    ignore: "心当たりがない場合は、このメールを無視してください。",
  },
  ko: {
    subject: "KaniCasino 계정 인증",
    preview: "이메일을 확인하고 리더보드, 마켓, 레인을 이용하세요.",
    hi: "{name}님, 안녕하세요!",
    body: "이 이메일 주소를 확인하여 KaniCasino 계정을 인증하세요. 인증된 계정은 리더보드에 참가하고, 마켓에서 거래하고, 레인에 참여할 수 있습니다.",
    button: "내 계정 인증하기",
    expires: "링크는 24시간 동안 유효합니다.",
    ignore: "요청하지 않았다면 이 이메일을 무시하셔도 됩니다.",
  },
  zh: {
    subject: "验证你的 KaniCasino 账户",
    preview: "确认邮箱，即可参与排行榜、市场和红包池。",
    hi: "{name}，你好！",
    body: "请确认此邮箱地址以验证你的 KaniCasino 账户。已验证的账户可以参与排行榜、在市场交易并加入红包池。",
    button: "验证我的账户",
    expires: "链接在 24 小时内有效。",
    ignore: "如果这不是你本人的操作，可以忽略这封邮件。",
  },
  vi: {
    subject: "Xác minh tài khoản KaniCasino của bạn",
    preview: "Xác nhận email để mở bảng xếp hạng, chợ và mưa.",
    hi: "Chào {name}!",
    body: "Hãy xác nhận địa chỉ email này để xác minh tài khoản KaniCasino của bạn. Tài khoản đã xác minh có thể thi đấu trên bảng xếp hạng, giao dịch ở chợ và tham gia mưa.",
    button: "Xác minh tài khoản",
    expires: "Liên kết có hiệu lực trong 24 giờ.",
    ignore: "Nếu bạn không yêu cầu, hãy bỏ qua email này.",
  },
  id: {
    subject: "Verifikasi akun KaniCasino Anda",
    preview: "Konfirmasi email Anda untuk membuka papan peringkat, pasar, dan hujan.",
    hi: "Halo, {name}!",
    body: "Konfirmasi alamat email ini untuk memverifikasi akun KaniCasino Anda. Akun terverifikasi bisa bersaing di papan peringkat, berdagang di pasar, dan ikut hujan.",
    button: "Verifikasi akun saya",
    expires: "Tautan berlaku selama 24 jam.",
    ignore: "Jika Anda tidak memintanya, abaikan email ini.",
  },
  pl: {
    subject: "Zweryfikuj swoje konto KaniCasino",
    preview: "Potwierdź email, żeby odblokować ranking, rynek i deszcz.",
    hi: "Cześć, {name}!",
    body: "Potwierdź ten adres email, żeby zweryfikować swoje konto KaniCasino. Zweryfikowane konta mogą rywalizować w rankingu, handlować na rynku i dołączać do deszczu.",
    button: "Zweryfikuj moje konto",
    expires: "Link działa przez 24 godziny.",
    ignore: "Jeśli to nie twoja prośba, możesz zignorować tego maila.",
  },
};

const P = "margin:0 0 16px;font-size:15px;line-height:1.65;color:#3C3A4B";

// the subject, html and text of a verification email for this token
function build({ name, token, lang }) {
  const c = COPY[String(lang || "").slice(0, 2)] || COPY.en;
  const link = `${SITE}/verify-email?token=${encodeURIComponent(token)}`;
  const hi = c.hi.replace("{name}", escape(name || ""));

  const html = `
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F1F0F5;opacity:0">${c.preview}</div>
<div style="background:#F1F0F5;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto">
    <div style="font:700 20px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#4F46E5;padding:0 8px 20px">KaniCasino</div>
    <div style="background:#FFFFFF;border-radius:10px;overflow:hidden">
    <div style="padding:34px 32px 36px">
      <h1 style="margin:0 0 24px;font-size:23px;line-height:1.3;color:#16151F">${c.subject}</h1>
      <p style="${P}"><strong>${hi}</strong></p>
      <p style="${P}">${c.body}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 22px">
        <tr><td align="center" bgcolor="#4F46E5" style="border-radius:6px">
          <a href="${link}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none">${c.button} &#8594;</a>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6B6880">${c.expires}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6B6880">${c.ignore}</p>
    </div>
    </div>
  </div>
</div>`;

  const text = `${c.subject}

${c.hi.replace("{name}", name || "")}

${c.body}

${c.button}: ${link}

${c.expires}
${c.ignore}`;

  return { subject: c.subject, html, text };
}

module.exports = { build, LANGUAGES: Object.keys(COPY) };
