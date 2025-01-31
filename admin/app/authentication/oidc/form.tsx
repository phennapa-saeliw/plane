import { FC, useState } from "react";
import isEmpty from "lodash/isEmpty";
import Link from "next/link";
import { useForm } from "react-hook-form";
// types
import { IFormattedInstanceConfiguration, TInstanceConfigurationKeys, TInstanceOpenIDConnectAuthenticationConfigurationKeys } from "@plane/types";
// ui
import { Button, TOAST_TYPE, getButtonStyling, setToast, ToggleSwitch, setPromiseToast } from "@plane/ui";
// components
import {
  CodeBlock,
  ConfirmDiscardModal,
  ControllerInput,
  CopyField,
  TControllerInputFormField,
  TCopyField,
} from "@/components/common";
// helpers
import { API_BASE_URL, cn } from "@/helpers/common.helper";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type OpenIDConnectConfigFormValues = Record<TInstanceOpenIDConnectAuthenticationConfigurationKeys, string>;

export const InstanceOpenIDConnectConfigForm: FC<Props> = (props) => {
  const { config } = props;
  // states
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
  const [isSubmittingAuto, setIsSubmittingAuto] = useState(false);
  // store hooks
  const { formattedConfig, updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<OpenIDConnectConfigFormValues>({
    defaultValues: {
      OIDC_CLIENT_ID: config["OIDC_CLIENT_ID"],
      OIDC_CLIENT_SECRET: config["OIDC_CLIENT_SECRET"],
      OIDC_URL_AUTHORIZATION: config["OIDC_URL_AUTHORIZATION"],
      OIDC_URL_TOKEN: config["OIDC_URL_TOKEN"],
      OIDC_URL_USERINFO: config["OIDC_URL_USERINFO"],
      OIDC_URL_ENDSESSION: config["OIDC_URL_ENDSESSION"],
    },
  });

  const updateConfig = async (key: TInstanceConfigurationKeys, value: string) => {
    setIsSubmittingAuto(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "Saving configuration",
      success: {
        title: "Success",
        message: () => "Configuration saved successfully",
      },
      error: {
        title: "Error",
        message: () => "Failed to save configuration",
      },
    });

    await updateConfigPromise
      .then(() => {
        setIsSubmittingAuto(false);
      })
      .catch((err) => {
        console.error(err);
        setIsSubmittingAuto(false);
      });
  };

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const OIDC_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "OIDC_URL_AUTHORIZATION",
      type: "text",
      label: "Authorization Endpoint",
      description: (
        <>Example: https://idp.your-company.com/o/authorize/. This is the URL where users will be redirected to</>
      ),
      placeholder: "https://idp.your-company.com/o/authorize/",
      error: Boolean(errors.OIDC_URL_AUTHORIZATION),
      required: true,
    },
    {
      key: "OIDC_URL_TOKEN",
      type: "text",
      label: "Token Endpoint",
      description: (
        <>
          Example: https://idp.your-company.com/o/token/. This is the URL where we will exchange the code for an access
          token.
        </>
      ),
      placeholder: "https://idp.your-company.com/o/token/",
      error: Boolean(errors.OIDC_URL_TOKEN),
      required: true,
    },
    {
      key: "OIDC_URL_USERINFO",
      type: "text",
      label: "UserInfo Endpoint",
      description: (
        <>Example: https://idp.your-company.com/o/userinfo/. This is the URL where we will get user information.</>
      ),
      placeholder: "https://idp.your-company.com/o/userinfo/",
      error: Boolean(errors.OIDC_URL_USERINFO),
      required: true,
    },
    {
      key: "OIDC_URL_ENDSESSION",
      type: "text",
      label: "EndSession Endpoint",
      description: (
        <>Example: https://idp.your-company.com/o/revoke/. This is the URL where we will revoke the users session.</>
      ),
      placeholder: "https://idp.your-company.com/o/revoke/",
      error: Boolean(errors.OIDC_URL_ENDSESSION),
      required: false,
    },
    {
      key: "OIDC_CLIENT_ID",
      type: "text",
      label: "Client ID",
      description: <>Get this from your OpenID Connect Provider.</>,
      placeholder: "c2ef2e7fc4e9d15aa7630f5637d59e8e4a27ff01dceebdb26b0d267b9adcf3c3",
      error: Boolean(errors.OIDC_CLIENT_ID),
      required: true,
    },
    {
      key: "OIDC_CLIENT_SECRET",
      type: "password",
      label: "Client Secret",
      description: <>Get this from your OpenID Connect Provider as well.</>,
      placeholder: "gloas-f79cfa9a03c97f6ffab303177a5a6778a53c61e3914ba093412f68a9298a1b28",
      error: Boolean(errors.OIDC_CLIENT_SECRET),
      required: true,
    },
  ];

  const OIDC_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URL",
      label: "Callback URL",
      url: `${originURL}/auth/oidc/callback/`,
      description: (
        <>
          We will auto-generate this. Paste this into the <CodeBlock darkerShade>Redirect URI</CodeBlock> field of your
          OpenID Connect Provider.
        </>
      ),
    },
  ];

  const onSubmit = async (formData: OpenIDConnectConfigFormValues) => {
    const payload: Partial<OpenIDConnectConfigFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then((response = []) => {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Done!",
          message: "Your OpenIDConnect authentication is configured. You should test it now.",
        });
        reset({
          OIDC_CLIENT_ID: response.find((item) => item.key === "OIDC_CLIENT_ID")?.value,
          OIDC_CLIENT_SECRET: response.find((item) => item.key === "OIDC_CLIENT_SECRET")?.value,
          OIDC_URL_AUTHORIZATION: response.find((item) => item.key === "OIDC_URL_AUTHORIZATION")?.value,
          OIDC_URL_TOKEN: response.find((item) => item.key === "OIDC_URL_TOKEN")?.value,
          OIDC_URL_USERINFO: response.find((item) => item.key === "OIDC_URL_USERINFO")?.value,
          OIDC_URL_ENDSESSION: response.find((item) => item.key === "OIDC_URL_ENDSESSION")?.value,
        });
      })
      .catch((err) => console.error(err));
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };


  const automaticOpenIDConnectRedirect = formattedConfig?.IS_OIDC_AUTO ?? "";

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-2 gap-x-12 gap-y-8 w-full">
          <div className="flex flex-col gap-y-4 col-span-2 md:col-span-1 pt-1">
            <div className="pt-2.5 text-xl font-medium">GitLab-provided details for Plane</div>
            {OIDC_FORM_FIELDS.map((field) => (
              <ControllerInput
                key={field.key}
                control={control}
                type={field.type}
                name={field.key}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                error={field.error}
                required={field.required}
              />
            ))}
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={!isDirty}>
                  {isSubmitting ? "Saving..." : "Save changes"}
                </Button>
                <Link
                  href="/authentication"
                  className={cn(getButtonStyling("link-neutral", "md"), "font-medium")}
                  onClick={handleGoBack}
                >
                  Go back
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 px-6 pt-1.5 pb-4 bg-custom-background-80/60 rounded-lg">
              <div className="pt-2 text-xl font-medium">Plane-provided details for OpenID Connect</div>
              {OIDC_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
              <ToggleSwitch
                label="Automatic OpenID Connect Redirect (only activate if tested!)"
                value={Boolean(parseInt(automaticOpenIDConnectRedirect))}
                onChange={() => {
                  Boolean(parseInt(automaticOpenIDConnectRedirect)) === true
                    ? updateConfig("IS_OIDC_AUTO", "0")
                    : updateConfig("IS_OIDC_AUTO", "1");
                }}
                size="sm"
                disabled={isSubmittingAuto}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
