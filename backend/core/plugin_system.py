"""Backend Plugin System — lightweight plugin API for Python plugins."""
import os
import json
import importlib.util
from typing import Optional
from fastapi import APIRouter


class BackendPlugin:
    """Represents a loaded backend plugin."""

    def __init__(self, manifest: dict, module, path: str):
        self.manifest = manifest
        self.module = module
        self.path = path
        self.router: Optional[APIRouter] = None

    @property
    def id(self) -> str:
        return self.manifest.get("id", "")

    @property
    def name(self) -> str:
        return self.manifest.get("name", self.id)


class PluginManager:
    """Loads and manages backend plugins."""

    def __init__(self):
        self.plugins: list[BackendPlugin] = []

    def load_plugins(self, vault_path: str) -> int:
        """Scan plugins/ directory and load all valid plugins."""
        plugins_dir = os.path.join(vault_path, "plugins")
        if not os.path.isdir(plugins_dir):
            return 0

        loaded = 0
        for entry in os.scandir(plugins_dir):
            if not entry.is_dir():
                continue

            manifest_path = os.path.join(entry.path, "plugin.json")
            main_path = os.path.join(entry.path, "main.py")

            if not os.path.isfile(manifest_path) or not os.path.isfile(main_path):
                continue

            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)

                spec = importlib.util.spec_from_file_location(
                    f"plugin_{manifest.get('id', entry.name)}", main_path
                )
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                plugin = BackendPlugin(manifest, module, entry.path)
                self.plugins.append(plugin)
                loaded += 1
                print(f"[plugin] Loaded backend plugin: {plugin.name}")
            except Exception as e:
                print(f"[plugin] Failed to load {entry.name}: {e}")

        return loaded

    def activate_all(self, app):
        """Activate all loaded plugins — register routes, hooks, etc."""
        for plugin in self.plugins:
            try:
                if hasattr(plugin.module, "activate"):
                    plugin.module.activate(app, plugin.manifest)
                    print(f"[plugin] Activated: {plugin.name}")
            except Exception as e:
                print(f"[plugin] Failed to activate {plugin.name}: {e}")

    def deactivate_all(self):
        """Deactivate all plugins."""
        for plugin in self.plugins:
            try:
                if hasattr(plugin.module, "deactivate"):
                    plugin.module.deactivate()
            except Exception as e:
                print(f"[plugin] Failed to deactivate {plugin.name}: {e}")


# Singleton
plugin_manager = PluginManager()
