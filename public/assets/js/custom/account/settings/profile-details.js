"use strict";

var KTAccountSettingsProfileDetails = function () {
    var e, t;

    return {
        init: function () {
            e = document.getElementById("kt_account_profile_details_form");

            if (!e) {
                return;
            }

            t = FormValidation.formValidation(e, {
                fields: {
                    firstName: {
                        validators: {
                            notEmpty: {
                                message: "First name is required"
                            }
                        }
                    },
                    lastName: {
                        validators: {
                            notEmpty: {
                                message: "Last name is required"
                            }
                        }
                    },
                    email: {
                        validators: {
                            notEmpty: {
                                message: "Company name is required"
                            }
                        }
                    }
                },
                plugins: {
                    trigger: new FormValidation.plugins.Trigger,
                    submitButton: new FormValidation.plugins.SubmitButton,
                    bootstrap: new FormValidation.plugins.Bootstrap5({
                        rowSelector: ".fv-row",
                        eleInvalidClass: "",
                        eleValidClass: ""
                    })
                }
            });

      // Add a click event listener to the "Save Changes" button
      var saveChangesButton = document.getElementById("kt_account_profile_details_submit");
      saveChangesButton.addEventListener("click", function(event) {
          event.preventDefault(); // Prevent the default form submission

          // Create a Swal.fire confirmation dialog
          var swalFire = Swal.fire({
              text: "Are you sure you want to save the changes?",
              icon: "warning",
              showCancelButton: true,
              confirmButtonText: "Yes, Update User Details",
              cancelButtonText: "No, cancel",
              showLoaderOnConfirm: true, // Show a loading spinner on the "Yes" button
              preConfirm: function() {
                  return new Promise(function(resolve) {
                      console.log('logic begins');

                      // If the user confirms, validate the form
                      t.validate().then(function(status) {
                          if (status === "Valid") {
                              var form = document.getElementById("kt_account_profile_details_form");
                              var formData = new FormData(form);
                              fetch("/profile/settings", {
                                  method: "POST",
                                  body: formData
                              }).then((response)=> {
                                  if(response.status === 400) {
                                      return response.json().then((data)=> {
                                          Swal.fire({
                                              text: data.message,
                                              icon: "error",
                                              buttonsStyling: !1,
                                              confirmButtonText: "Ok, got it!",
                                              customClass: {
                                                  confirmButton: "btn btn-primary"
                                              }
                                          })
                                          .then(function() {
                                              // Close the Swal.fire popup after displaying the error
                                              resolve();
                                          });
                                      })
                                  } else if(response.status === 200) {
                                      // Close the loading popup
                                      Swal.close();

                                      Swal.fire({
                                          text: "Profile Details Updated Successfully",
                                          icon: "success",
                                          buttonsStyling: !1,
                                          confirmButtonText: "Ok, got it!",
                                          customClass: {
                                              confirmButton: "btn btn-primary"
                                          }
                                      }).then((data)=> {
                                          if(data.isConfirmed) {
                                              location.reload()
                                          }
                                      })
                                  }
                              });
                          } else {
                              // Close the Swal.fire popup if the form is not valid
                              resolve();
                          }
                      });
                  });
              }
          });
      });

        }
    };
}();

KTUtil.onDOMContentLoaded(function () {
    KTAccountSettingsProfileDetails.init();
});
