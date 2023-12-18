__author__ = "Monica Figuera and Philipp D. Rohde"

import itertools

class Shape:
    """This class represents a SHACL shape."""

    def __init__(self, id_, target_def, target_type, target_query, constraints, constraints_id, referenced_shapes,
                 use_selective_queries, max_split_size, order_by_in_queries, include_sparql_prefixes, prefixes=None):
        """
        Creates a new Shape instance representing a SHACL shape that needs to be evaluated.

        :param id_: the name of the shape
        :param target_def: target definition of the shape
        :param target_type: indicates the target type of the shape, e.g., class or node
        :param target_query: target query of the shape
        :param constraints: the constraints belonging to the shape
        :param constraints_id: the constraint ids
        :param referenced_shapes: a list of shapes that is referenced from this shape
        :param use_selective_queries: indicates whether or not selective queries are used
        :param max_split_size: maximum number of instances per query
        :param order_by_in_queries: indicates whether or not to use the ORDER BY clause
        :param include_sparql_prefixes: indicates whether or not to include SPARQL prefixes in queries for the shape
        """
        self.id = id_
        self.constraints = constraints
        self.constraintsId = constraints_id
        self.predicates = []
        self.targetDef = target_def
        self.targetType = target_type          # Might be None
        self.targetQuery = target_query        # Might be None
        self.targetQueryNoPref = target_query  # Might be None
        self.rulePattern = ()
        self.satisfied = None
        self.inDegree = None
        self.outDegree = None

        self.minQuery = None
        self.maxQueries = None
        self.predicates = []
        self.maxValidRefs = {}
        self.skippedQueriesIds = set()

        self.referencedShapes = referenced_shapes
        self.parentShapes = set()
        self.queriesWithVALUES = {}
        self.queriesWithFILTER_NOT_IN = {}  # complement of VALUES
        self.targets = {"valid": set(), "violated": set()}

        self.useSelectiveQueries = use_selective_queries
        self.querySplitThreshold = max_split_size
        self.ORDERBYinQueries = order_by_in_queries
        self.includePrefixes = include_sparql_prefixes
        if prefixes is None:
            self.prefixes = {}
        else:
            self.prefixes = prefixes
        self.maxConstrId = {}

    def get_id(self):
        return self.id

    def set_degree(self, in_, out_):
        self.inDegree = in_
        self.outDegree = out_

    def __compute_predicate_set(self, min_query_id, max_queries_ids):
        """ Returns the ids of the queries for this shape """
        return [self.id] + [self.id + "_d1"] + [min_query_id] + [q for q in max_queries_ids]

    def get_target_query(self):
        return self.targetQuery

    def get_constraints(self):
        return self.constraints

    def get_number_constraints(self):
        """ Gets the number of constraints belonging to this shape """
        return len(self.constraints)

    def get_shape_refs(self):
        return [c.get_shape_ref() for c in self.constraints if c.get_shape_ref() is not None]

    def get_rule_pattern(self):
        return self.rulePattern

    def get_query_split_threshold(self):
        return self.querySplitThreshold

    def add_parent_shape(self, name):
        """ Adds name of incoming neighbor shape in the schema """
        return self.parentShapes.add(name)

    def get_parent_shapes(self):
        return self.parentShapes

    def get_valid_targets(self):
        return self.targets["valid"]

    def get_invalid_targets(self):
        return self.targets["violated"]
