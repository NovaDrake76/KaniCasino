// the verification lock and the verified-only commission start on fixed dates. a suite run after them must not
// change what every older test expects, so tests opt in by setting these themselves.
process.env.VERIFY_REQUIRED_FROM = process.env.VERIFY_REQUIRED_FROM || "2100-01-01T00:00:00Z";
process.env.REFERRAL_VERIFIED_FROM = process.env.REFERRAL_VERIFIED_FROM || "2100-01-01T00:00:00Z";
