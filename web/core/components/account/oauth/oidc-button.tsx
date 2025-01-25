import { FC, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
// helpers
import { API_BASE_URL } from "@/helpers/common.helper";
// hooks
import { useInstance } from "@/hooks/store";
// images
import OIDCLogo from "@/public/logos/oidc-logo.svg";

export type OpenIDConnectButtonProps = {
  text: string;
};

export const OpenIDConnectButton: FC<OpenIDConnectButtonProps> = (props) => {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next_path") || undefined;
  const { text } = props;
  // hooks
  const { resolvedTheme } = useTheme();
  const { config } = useInstance();

  const handleSignIn = () => {
    window.location.assign(`${API_BASE_URL}/auth/oidc/${nextPath ? `?next_path=${nextPath}` : ``}`);
  };

  useEffect(() => {
    if (config?.is_oidc_enabled && config?.is_oidc_auto) handleSignIn();
  }, [config]);

  return (
    <button
      className={`flex h-[42px] w-full items-center justify-center gap-2 rounded border px-2 text-sm font-medium text-custom-text-100 duration-300 bg-onboarding-background-200 hover:bg-onboarding-background-300 ${
        resolvedTheme === "dark" ? "border-[#43484F]" : "border-[#D9E4FF]"
      }`}
      onClick={handleSignIn}
    >
      <Image src={OIDCLogo} height={20} width={20} alt="OpenID Connect Logo" />
      {text}
    </button>
  );
};
