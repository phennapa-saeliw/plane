# Python imports
import os
from datetime import datetime
from urllib.parse import urlencode
from base64 import b64encode

import pytz
import requests

# Module imports
from plane.authentication.adapter.oauth import OauthAdapter
from plane.license.utils.instance_value import get_configuration_value
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)


class OpenIDConnectProvider(OauthAdapter):

    provider = "oidc"
    scope = "openid profile email offline_access"

    def __init__(self, request, code=None, state=None, callback=None):

        OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_URL_AUTHORIZATION, OIDC_URL_TOKEN, OIDC_URL_USERINFO = get_configuration_value(
            [
                {
                    "key": "OIDC_CLIENT_ID",
                    "default": os.environ.get("OIDC_CLIENT_ID"),
                },
                {
                    "key": "OIDC_CLIENT_SECRET",
                    "default": os.environ.get("OIDC_CLIENT_SECRET"),
                },
                {
                    "key": "OIDC_URL_AUTHORIZATION",
                    "default": os.environ.get("OIDC_URL_AUTHORIZATION"),
                },
                {
                    "key": "OIDC_URL_TOKEN",
                    "default": os.environ.get("OIDC_URL_TOKEN"),
                },
                {
                    "key": "OIDC_URL_USERINFO",
                    "default": os.environ.get("OIDC_URL_USERINFO"),
                }
            ]
        )

        self.token_url = OIDC_URL_TOKEN
        self.userinfo_url = OIDC_URL_USERINFO

        if not (OIDC_CLIENT_ID and OIDC_CLIENT_SECRET and OIDC_URL_AUTHORIZATION and OIDC_URL_TOKEN and OIDC_URL_USERINFO):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["OIDC_NOT_CONFIGURED"],
                error_message="OIDC_NOT_CONFIGURED",
            )

        client_id = OIDC_CLIENT_ID
        client_secret = OIDC_CLIENT_SECRET

        redirect_uri = f"""{"https" if request.is_secure() else "http"}://{request.get_host()}/auth/oidc/callback/"""
        url_params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": self.scope,
            "state": state,
            "response_type": "code"
        }
        auth_url = (
            f"{OIDC_URL_AUTHORIZATION}?{urlencode(url_params)}"
        )
        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            self.token_url,
            self.userinfo_url,
            client_secret,
            code,
            callback=callback,
        )

    def set_token_data(self):
        data = {
            "code": self.code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        basic_auth = b64encode(f"{self.client_id}:{self.client_secret}".encode('utf-8')).decode("ascii")
        headers = {
            "Accept": "application/json",
            "content-type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic_auth}",
        }
        token_response = self.get_user_token(
            data=data, headers=headers
        )
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.fromtimestamp(
                        token_response.get("expires_in"),
                        tz=pytz.utc,
                    )
                    if token_response.get("expires_in")
                    else None
                ),
                "refresh_token_expired_at": (
                    datetime.fromtimestamp(
                        token_response.get("refresh_token_expired_at"),
                        tz=pytz.utc,
                    )
                    if token_response.get("refresh_token_expired_at")
                    else None
                ),
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info_response = self.get_user_response()
        email = user_info_response.get("email")
        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": user_info_response.get("sub"),
                    "email": email,
                    "avatar": user_info_response.get("avatar_url", ""),
                    "first_name": user_info_response.get("name", ""),
                    "last_name": user_info_response.get("family_name", ""),
                    "is_password_autoset": True,
                },
            }
        )
