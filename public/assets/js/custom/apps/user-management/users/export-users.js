"use strict";
var KTModalExportUsers = function() {
    const t = document.getElementById("kt_modal_export_users"),
        e = t.querySelector("#kt_modal_export_users_form"),
        n = new bootstrap.Modal(t);
    return {
        init: function() {
            ! function() {
                var o = FormValidation.formValidation(e, {
                    fields: {
                        format: {
                            validators: {
                                notEmpty: {
                                    message: "File format is required"
                                }
                            }
                        }
                    },
                    plugins: {
                        trigger: new FormValidation.plugins.Trigger,
                        bootstrap: new FormValidation.plugins.Bootstrap5({
                            rowSelector: ".fv-row",
                            eleInvalidClass: "",
                            eleValidClass: ""
                        })
                    }
                });
                const i = t.querySelector('[data-kt-users-modal-action="submit"]');
                i.addEventListener("click", (t => {
                    t.preventDefault(), o && o.validate().then((function(t) {
                        console.log("validated!"), "Valid" == t ? (i.setAttribute("data-kt-indicator", "on"), i.disabled = !0, setTimeout((function() {
                           
                           
                            const data = new URLSearchParams();
                            for (const pair of new FormData(e)) {
                               data.append(pair[0], pair[1]);
                            }
                            fetch("/masters/users/export", {
                                method : "POST", 
                                headers : {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                body : data
                            }).then((data)=> {
                                if(data.status === 400) {

                                    return data.json().then((message)=> {
                                        Swal.fire({
                                            text: message.message,
                                            icon: "error",
                                            buttonsStyling: !1,
                                            confirmButtonText: "Ok, got it!",
                                            customClass: {
                                                confirmButton: "btn btn-primary"
                                            }
                                        }).then((response)=>{
                                            if(response.isConfirmed) {
                                                i.setAttribute("data-kt-indicator", "off")
                                                i.disabled = 0
                                            }
                                        })
                                    })

                                } else if(data.status === 200) {
                                    return data.json().then((format)=> {
                                        window.location.href="/exports/users."+format.format
                                    Swal.fire({
                                        text: "User Data Exported",
                                        icon: "success",
                                        buttonsStyling: !1,
                                        confirmButtonText: "Ok, got it!",
                                        customClass: {
                                            confirmButton: "btn btn-primary"
                                        }
                                    }).then((response)=> {
                                        if (response.isConfirmed) {
                                            i.setAttribute("data-kt-indicator", "off")
                                            i.disabled = 0
                                            n.hide()
                                            e.reset()
                                            setTimeout(() => {
                                              fetch('/delete-file?filename=' + "users."+format.format, {
                                                method: 'GET',
                                              })
                                                .then((fetchResponse) => {
                                                  if (fetchResponse.ok) {
                                                    console.log('File Deleted');
                                                  } else {
                                                    console.error('Fetch request failed');
                                                  }
                                                })
                                                .catch((error) => {
                                                  console.error('Fetch request error:', error);
                                                });
                                            }, 60000);
                                          }
                                          
                                    })
                                    })
                                } else if(data.status === 401) {
                                    Swal.fire({
                                        text: "You are not authorized to perform this action",
                                        icon: "error",
                                        buttonsStyling: !1,
                                        confirmButtonText: "Ok, got it!",
                                        customClass: {
                                            confirmButton: "btn btn-primary"
                                        }
                                    }).then((data)=> {
                                        if(data.isConfirmed) {
                                            i.setAttribute("data-kt-indicator", "off")
                                            i.disabled = 0
                                            n.hide()
                                            e.reset()
                                        }
                                    })
                                }
                            })




                        }), )) : Swal.fire({
                            text: "Please fill all required fields",
                            icon: "error",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        })
                    }))
                })), t.querySelector('[data-kt-users-modal-action="cancel"]').addEventListener("click", (function(t) {
                    t.preventDefault(), Swal.fire({
                        text: "Are you sure you would like to cancel?",
                        icon: "warning",
                        showCancelButton: !0,
                        buttonsStyling: !1,
                        confirmButtonText: "Yes, cancel it!",
                        cancelButtonText: "No, return",
                        customClass: {
                            confirmButton: "btn btn-primary",
                            cancelButton: "btn btn-active-light"
                        }
                    }).then((function(t) {
                        t.value ? (e.reset(), n.hide()) : "cancel" === t.dismiss && Swal.fire({
                            text: "Your form has not been cancelled!.",
                            icon: "error",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        })
                    }))
                })), t.querySelector('[data-kt-users-modal-action="close"]').addEventListener("click", (function(t) {
                    t.preventDefault(), Swal.fire({
                        text: "Are you sure you would like to cancel?",
                        icon: "warning",
                        showCancelButton: !0,
                        buttonsStyling: !1,
                        confirmButtonText: "Yes, cancel it!",
                        cancelButtonText: "No, return",
                        customClass: {
                            confirmButton: "btn btn-primary",
                            cancelButton: "btn btn-active-light"
                        }
                    }).then((function(t) {
                        t.value ? (e.reset(), n.hide()) : "cancel" === t.dismiss && Swal.fire({
                            text: "Your form has not been cancelled!.",
                            icon: "error",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        })
                    }))
                }))
            }()
        }
    }
}();
KTUtil.onDOMContentLoaded((function() {
    KTModalExportUsers.init()
}));