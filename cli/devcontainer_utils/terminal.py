from dataclasses import dataclass
from typing import Any, Callable, TypeVar

Echo = Callable[[str], Any]
Prompt = Callable[[str], str]


SomeTerminal = TypeVar("SomeTerminal", bound="Terminal")


@dataclass
class Terminal:
    echo: Echo
    prompt: Prompt
