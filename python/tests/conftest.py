import os

import pytest
import yaml
import json


@pytest.fixture
def read_fixture(request):
    def wrapper(filename):
        py_filename = request.module.__file__
        test_dir = os.path.dirname(py_filename)
        filepath = os.path.join(test_dir, 'fixtures', filename)
        if os.path.isdir(test_dir):
            with open(filepath) as file:
                return file.read()
        raise ValueError(f'File not found {filepath}')

    return wrapper


@pytest.fixture
def load_yaml_fixture(read_fixture):
    def wrapper(filename):
        return yaml.load(read_fixture(filename), Loader=yaml.Loader)

    return wrapper


@pytest.fixture
def load_json_fixture(read_fixture):
    def wrapper(filename):
        return json.loads(read_fixture(filename))

    return wrapper
