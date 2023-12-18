# -*- coding: utf-8 -*-
__author__ = 'Philipp D. Rohde'

import os

from TravSHACL.core.ShapeParser import ShapeParser as ShapeParserTravSHACL


class ShapeParser(ShapeParserTravSHACL):
    def __init__(self):
        super().__init__()

    def parse_shapes_from_dir(self, path, shape_format='SHACL', use_selective_queries=True, max_split_size=256,
                              order_by_in_queries=False):
        file_extensions = set()
        for root, _, files in os.walk(path):
            for file in files:
                file_path = os.path.join(root, file)
                file_extension = os.path.splitext(file_path)[1].lower()
                if file_extension == '.ttl' or file_extension == '.json':
                    file_extensions.add(file_extension)
        if len(file_extensions) != 1:
            raise ValueError('SHACL shape format cannot be determined from: ' + str(file_extensions))

        if file_extensions.pop() == '.json':
            shape_format = 'JSON'  # in order to keep support for the JSON format introduced by Corman et al.

        return super().parse_shapes_from_dir(path, shape_format, use_selective_queries, max_split_size, order_by_in_queries)
