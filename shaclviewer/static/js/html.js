// Helpers for inserting data into the page via innerHTML.
//
// Values that originate from outside of the viewer (rows of validation
// results, error messages of the server, ...) must be escaped before they are
// part of a string that is assigned to innerHTML; otherwise, e.g., a literal
// like `<img src=x onerror=...>` in the queried data would run script in the
// origin of the page, which is the origin of the host application when the
// viewer is embedded into one.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes a value for use as text or as quoted attribute value in HTML. */
export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/**
 * Builds the HTML of the table listing the validated data of a shape.
 *
 * @param {string[]}   columns   names of the columns
 * @param {Array[]}    rows      the rows of the table
 * @param {number}     dataIndex index of the column holding the data node
 */
export function buildDataTableHtml(columns, rows, dataIndex) {
    let html = '<table id="myTable" class="display"><thead><tr>';
    columns.forEach(col => { html += `<th>${escapeHtml(col)}</th>`; });
    html += '<th>View Data</th></tr></thead><tbody>';
    rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => { html += `<td>${escapeHtml(cell)}</td>`; });
        html += `<td><button query-data="${escapeHtml(row[dataIndex])}" class="btn btn-primary view-data-graph btn-view-data">View</button></td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}
