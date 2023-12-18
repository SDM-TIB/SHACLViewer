# -*- coding: utf-8 -*-
__author__ = "Monica Figuera and Philipp D. Rohde"

import copy
import os
import random

from TravSHACL.constraints.Constraint import Constraint
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

    @staticmethod
    def prettify_graph(graph):
        for node in graph:
            node.targetQuery = node.targetQuery.replace('\n', ' ')
            # merge all constraints with the same path
            # get a list of all similar constraints
            duplicate_list = []
            for constraint_index in range(0, len(node.constraints)):
                current_constraint = node.constraints[constraint_index]

                # compare with the rest of the constraints
                for other_constraint_index in range(constraint_index + 1, len(node.constraints)):
                    other_constraint = node.constraints[other_constraint_index]
                    if other_constraint.path == current_constraint.path and other_constraint.shapeRef == current_constraint.shapeRef:
                        # merge
                        if other_constraint.min != -1:
                            current_constraint.min = other_constraint.min
                        if other_constraint.max != -1:
                            current_constraint.max = other_constraint.max
                        # save index for deletion
                        duplicate_list.append(other_constraint_index)

            for delete_index in sorted(duplicate_list, reverse=True):
                del node.constraints[delete_index]

            # if it starts with "<http" it is a url
            for constraint in node.constraints:
                if constraint.path.startswith('<http'):
                    constraint.path = constraint.path.split('/')[-1][:-1]
                if constraint.path.startswith('ub:'):
                    constraint.path = constraint.path.split(':')[-1]

    @staticmethod
    def duplicate_graph(graph, times):
        new_graph = graph
        for x in range(times):
            copy_graph = copy.deepcopy(graph)
            for node in copy_graph:
                node.id = node.id + '_' + str(x)
                for constraint in node.constraints:
                    if constraint.shapeRef is not None:
                        constraint.shapeRef = constraint.shapeRef + '_' + str(x)

            source_node = new_graph[random.randint(0, len(new_graph) - 1)]
            target_node = copy_graph[random.randint(0, len(copy_graph) - 1)]
            new_constraint = Constraint(id_='copyLink_' + str(x), shape_ref=target_node.id, path='copyLink')
            source_node.constraints.append(new_constraint)

            new_graph += copy_graph

        return new_graph
