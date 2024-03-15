document.addEventListener('DOMContentLoaded', function () {
    const table = $('#kt_permissions_table').DataTable(); // Replace 'your-table-id' with your table's actual ID.

    // Add a single click event listener to the table body using DataTables API.
    table.on('click', '.delete-button', function (event) {
        const row = table.row($(this).closest('tr'));
        const rowNode = row.node();
        const rowId = rowNode.dataset.rowid;

        Swal.fire({
            title: 'Delete Confirmation',
            text: 'Are you sure you want to delete this record?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes! Delete it!',
            cancelButtonText: 'Cancel',
            customClass: {
                confirmButton: "btn-red"
            },
            onBeforeOpen: () => {
                Swal.showLoading(); // Show circular progress bar
                Swal.getConfirmButton().textContent = 'Proceeding...'; // Change button text
                Swal.getConfirmButton().setAttribute('disabled', true); // Disable button
            },
            allowOutsideClick: () => !Swal.isLoading(), // Prevent closing on outside click while loading
        }).then((result) => {
            if (result.isConfirmed) {
                // Simulate an asynchronous action with a timeout
                setTimeout(() => {
                    const formData = new URLSearchParams();
                    formData.append("id", rowId);
                    fetchPostRequest('/user-management/permissions/delete', formData.toString(), "Permission deleted Successfully");
                   
                },); // Change this to your actual data fetching logic
            }
        });
    });
});
