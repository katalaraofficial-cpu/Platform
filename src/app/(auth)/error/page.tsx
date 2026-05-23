export default async function AuthError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  const messages: Record<string, string> = {
    no_profile: "Akun Anda belum memiliki profil. Hubungi administrator.",
    no_tenant: "Akun Anda belum dikaitkan dengan bengkel manapun. Hubungi administrator.",
  };

  const message =
    messages[reason ?? ""] ??
    "Terjadi kesalahan autentikasi. Silakan coba lagi.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 text-center">
        <h1 className="text-xl font-bold text-red-600 mb-2">Akses Ditolak</h1>
        <p className="text-sm text-gray-600">{message}</p>
        <a
          href="/auth/login"
          className="mt-6 inline-block text-sm text-primary hover:underline"
        >
          Kembali ke halaman login
        </a>
      </div>
    </div>
  );
}
