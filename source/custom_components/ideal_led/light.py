"""Light entity backed by the shared iDeal LED server."""
from typing import Any

from homeassistant.components.light import (
    ATTR_BRIGHTNESS, ATTR_EFFECT, ATTR_HS_COLOR,
    ColorMode, LightEntity, LightEntityFeature,
)
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers import device_registry

from .const import DOMAIN
from .idealled import IDEALLEDInstance


async def async_setup_entry(hass, config_entry, async_add_devices):
    instance = hass.data[DOMAIN][config_entry.entry_id]
    await instance.update()
    async_add_devices([IDEALLEDLight(instance, config_entry.data["name"], config_entry.entry_id)])


class IDEALLEDLight(LightEntity):
    _attr_should_poll = False
    _attr_supported_color_modes = {ColorMode.HS}
    _attr_color_mode = ColorMode.HS
    _attr_supported_features = LightEntityFeature.EFFECT

    def __init__(self, instance: IDEALLEDInstance, name: str, entry_id: str) -> None:
        self._instance = instance
        self._attr_name = name
        self._attr_unique_id = instance.mac

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        self._instance.local_callback = self.async_write_ha_state

    async def async_will_remove_from_hass(self):
        self._instance.local_callback = None
        await super().async_will_remove_from_hass()

    @property
    def available(self):
        return self._instance.available

    @property
    def brightness(self):
        return self._instance.brightness

    @property
    def is_on(self):
        return self._instance.is_on

    @property
    def hs_color(self):
        return self._instance.hs_color

    @property
    def effect_list(self):
        return self._instance.effect_list

    @property
    def effect(self):
        return self._instance.effect

    @property
    def device_info(self):
        return DeviceInfo(
            identifiers={(DOMAIN, self._instance.mac)},
            name=self.name,
            connections={(device_registry.CONNECTION_NETWORK_MAC, self._instance.mac)},
            model=self._instance._model,
            sw_version=self._instance.firmware_version,
        )

    async def async_turn_on(self, **kwargs: Any) -> None:
        if not self.is_on:
            await self._instance.turn_on()
        brightness = kwargs.get(ATTR_BRIGHTNESS)
        if ATTR_EFFECT in kwargs:
            await self._instance.set_effect(kwargs[ATTR_EFFECT], brightness)
        elif ATTR_HS_COLOR in kwargs:
            await self._instance.set_rgb_color(kwargs[ATTR_HS_COLOR], brightness)
        elif brightness is not None:
            await self._instance.set_brightness(brightness)
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._instance.turn_off()
        self.async_write_ha_state()
