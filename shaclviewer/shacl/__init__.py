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

        # if it starts with "<http" it is a URL
        for constraint in node.constraints:
            constraint.pathURL = constraint.path
            if constraint.path.startswith('<http'):
                if '#' in constraint.path:
                    constraint.path = constraint.path.split('#')[-1][:-1]
                else:
                    constraint.path = constraint.path.split('/')[-1][:-1]
            elif ':' in constraint.path:
                constraint.path = constraint.path.split(':')[-1]
