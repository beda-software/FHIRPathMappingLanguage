# FHIRPathMappingLanguage - fpml python package

## Installation

```bash
pip install fpml
```

## Usage

```python
from fpml import resolve_template
```

## Development

In `./python` directory:

Run in the shell
```
autohooks activate
```

And edit `../.git/hooks/pre-commit` by replacing the first line with
```
#!/usr/bin/env -S poetry --project=./python run python
```

