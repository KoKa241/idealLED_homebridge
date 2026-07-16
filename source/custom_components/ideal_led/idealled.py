import asyncio
import logging
import aiohttp
from typing import Tuple
from homeassistant.components.light import ColorMode
from homeassistant.helpers.aiohttp_client import async_get_clientsession

LOGGER = logging.getLogger(__name__)

EFFECT_MAP = {}
for i in range(1, 11):
    EFFECT_MAP[f"Effect {i:02d}"] = i

EFFECT_LIST = sorted(EFFECT_MAP)

class IDEALLEDInstance:
    def __init__(self, address: str, delay: int, fw_version: str, host: str, port: int, hass) -> None:
        self._mac = address
        self._delay = delay
        self._firmware_version = fw_version
        self._host = host
        self._port = port
        self._hass = hass
        
        self.name = f"IDL-{self._mac[-8:].replace(':', '')}"
        
        self._is_on = None
        self._hs_color = (0, 0)
        self._brightness = 255
        self._effect = None
        self._effect_speed = 50
        self._color_mode = ColorMode.HS
        
        # In a full implementation, we might still want model detection locally 
        # or just let the server handle it. We can set it to a default.
        self._model = "Remote_LED" 
        
        self.local_callback = None
        self.speed_local_callback = None

    @property
    def mac(self):
        return self._mac

    @property
    def firmware_version(self):
        return self._firmware_version

    @property
    def is_on(self):
        return self._is_on

    @property
    def brightness(self):
        return self._brightness

    @property
    def hs_color(self):
        return self._hs_color

    @property
    def effect_list(self) -> list[str]:
        return EFFECT_LIST

    @property
    def effect(self):
        return self._effect

    @property
    def color_mode(self):
        return self._color_mode

    async def _send_command(self, payload: dict):
        session = async_get_clientsession(self._hass)
        url = f"http://{self._host}:{self._port}/api/device/{self._mac}/command"
        payload["fw_version"] = self._firmware_version
        payload["delay"] = self._delay
        
        try:
            async with session.post(url, json=payload, timeout=5) as response:
                if response.status != 200:
                    LOGGER.error(f"Error from server: {await response.text()}")
        except Exception as e:
            LOGGER.error(f"Failed to send command to server: {e}")

    async def update(self):
        session = async_get_clientsession(self._hass)
        url = f"http://{self._host}:{self._port}/api/device/{self._mac}/state"
        try:
            async with session.get(url, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "success":
                        state = data.get("state", {})
                        self._is_on = state.get("is_on")
                        self._brightness = state.get("brightness", 255)
                        self._hs_color = tuple(state.get("hs_color", (0,0))) if state.get("hs_color") else (0,0)
                        self._effect = state.get("effect")
                        self._effect_speed = state.get("effect_speed", 50)
                        self._color_mode = state.get("color_mode", ColorMode.HS)
                        self._firmware_version = state.get("firmware_version", self._firmware_version)
                        
                        if self.local_callback:
                            self.local_callback()
                        if self.speed_local_callback:
                            self.speed_local_callback()
        except Exception as e:
            LOGGER.debug(f"Failed to update state from server: {e}")

    async def turn_on(self):
        await self._send_command({"command": "turn_on"})
        self._is_on = True

    async def turn_off(self):
        await self._send_command({"command": "turn_off"})
        self._is_on = False

    async def set_brightness(self, brightness: int):
        brightness = max(0, min(255, brightness))
        self._brightness = brightness
        await self._send_command({
            "command": "set_brightness",
            "brightness": brightness
        })

    async def set_rgb_color(self, hs_col: Tuple[int, int], brightness: int | None = None):
        self._hs_color = hs_col
        if brightness is not None:
            self._brightness = brightness
        self._effect = None
        self._color_mode = ColorMode.HS
        await self._send_command({
            "command": "set_rgb_color",
            "hs_color": hs_col,
            "brightness": self._brightness
        })

    async def set_effect(self, effect: str, brightness: int | None = None):
        if effect not in EFFECT_LIST:
            LOGGER.error("Effect %s not supported", effect)
            return
        self._effect = effect
        self._color_mode = ColorMode.BRIGHTNESS
        if brightness is not None:
            self._brightness = brightness
        await self._send_command({
            "command": "set_effect",
            "effect": effect,
            "brightness": self._brightness
        })
        
    async def set_effect_speed(self, speed: int):
        self._effect_speed = speed
        await self._send_command({
            "command": "set_effect_speed",
            "speed": speed
        })

    async def stop(self):
        # We don't have an active BLE connection to disconnect here, 
        # but we can optionally tell the server to release the device if we want.
        pass
