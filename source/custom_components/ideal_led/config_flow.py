import asyncio
import logging
from typing import Any
import voluptuous as vol
import aiohttp

from homeassistant import config_entries
from homeassistant.const import CONF_MAC
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import DOMAIN, CONF_DELAY, CONF_HOST, CONF_PORT

LOGGER = logging.getLogger(__name__)

class iDealLedFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 2
    CONNECTION_CLASS = config_entries.CONN_CLASS_LOCAL_POLL

    def __init__(self) -> None:
        self.host = None
        self.port = 8282
        self.mac = None
        self.name = None
        self._discovered_devices = []
        self.firmware_version = "0.0.1"

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Step 1: Get Server Host and Port."""
        errors = {}
        if user_input is not None:
            self.host = user_input[CONF_HOST]
            self.port = user_input.get(CONF_PORT, 8282)
            return await self.async_step_discover()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_HOST): str,
                vol.Optional(CONF_PORT, default=8282): int,
            }),
            errors=errors
        )

    async def async_step_discover(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Step 2: Discover devices from the server."""
        errors = {}
        
        if user_input is not None:
            self.mac = user_input[CONF_MAC]
            self.name = next((d["name"] for d in self._discovered_devices if d["mac"] == self.mac), self.mac)
            await self.async_set_unique_id(self.mac, raise_on_progress=False)
            self._abort_if_unique_id_configured()
            return await self.async_step_validate()

        session = async_get_clientsession(self.hass)
        url = f"http://{self.host}:{self.port}/api/discover"
        try:
            async with session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    self._discovered_devices = data.get("devices", [])
                else:
                    errors["base"] = "cannot_connect"
        except Exception as e:
            LOGGER.error(f"Failed to discover devices: {e}")
            errors["base"] = "cannot_connect"

        if not self._discovered_devices:
            if not errors:
                errors["base"] = "no_devices_found"
            mac_dict = {}
        else:
            mac_dict = {dev["mac"]: f"{dev['name']} ({dev['mac']})" for dev in self._discovered_devices}

        # Allow manual entry as well by mixing the schema if needed, but a strict dropdown is easier.
        if not mac_dict:
             return self.async_show_form(
                step_id="discover", 
                data_schema=vol.Schema({
                    vol.Required(CONF_MAC): str,
                }),
                errors=errors
            )

        return self.async_show_form(
            step_id="discover", 
            data_schema=vol.Schema({
                vol.Required(CONF_MAC): vol.In(mac_dict),
            }),
            errors=errors
        )

    async def async_step_validate(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        if user_input is not None:
            if user_input.get("flicker"):
                return self.async_create_entry(
                    title=self.name, 
                    data={
                        CONF_MAC: self.mac, 
                        "name": self.name, 
                        CONF_HOST: self.host, 
                        CONF_PORT: self.port,
                        "fw_version": self.firmware_version
                    }
                )
            if "retry" in user_input and not user_input["retry"]:
                return self.async_abort(reason="cannot_connect")

        error = await self.toggle_light_via_server()

        if error:
            return self.async_show_form(
                step_id="validate", 
                data_schema=vol.Schema({
                    vol.Required("retry"): bool
                }), 
                errors={"base": "connect"}
            )
        
        return self.async_show_form(
            step_id="validate", 
            data_schema=vol.Schema({
                vol.Required("flicker"): bool
            }), 
            errors={}
        )

    async def toggle_light_via_server(self):
        session = async_get_clientsession(self.hass)
        url = f"http://{self.host}:{self.port}/api/device/{self.mac}/test"
        try:
            async with session.post(url, timeout=15) as response:
                if response.status == 200:
                    data = await response.json()
                    self.firmware_version = data.get("fw_version", "0.0.1")
                    return None
                else:
                    return "error"
        except Exception as e:
            LOGGER.error(f"Flicker test failed: {e}")
            return "error"

    @staticmethod
    def async_get_options_flow(entry: config_entries.ConfigEntry):
        return OptionsFlowHandler(entry)

class OptionsFlowHandler(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self._config_entry = config_entry

    async def async_step_init(self, user_input=None):
        return await self.async_step_user()
    
    async def async_step_user(self, user_input=None):
        errors = {}
        options = self._config_entry.options or {CONF_DELAY: 120}
        if user_input is not None:
            return self.async_create_entry(title="", data={CONF_DELAY: user_input[CONF_DELAY]})

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Optional(CONF_DELAY, default=options.get(CONF_DELAY)): int
            }), 
            errors=errors
        )
