"use strict";
var KTUsersAddUser = function() {
    const t = document.getElementById("kt_modal_add_user"),
        e = t.querySelector("#addBranch"),
        n = new bootstrap.Modal(t);
    return {
        init: function() {
            (() => {
                var o = FormValidation.formValidation(e, {
                    fields: {
                        name: {
                            validators: {
                                notEmpty: {
                                    message: "Branch Name is Required"
                                }
                            }
                        }, branch: {
                            validators: {
                                notEmpty: {
                                    message: "Selecting State is Required"
                                }
                            }
                        },
                        serial: {
                            validators: {
                                notEmpty: {
                                    message: "Please Serial is Required"
                                }
                            }
                        },
                        std: {
                            validators: {
                                notEmpty: {
                                    message: "Branch STD Code is Required"
                                }
                            }
                        },
                        landline: {
                            validators: {
                                notEmpty: {
                                    message: "Branch Landline No. is Required"
                                }
                            }
                        },branchEmail: {
                            validators: {
                                notEmpty: {
                                    message: "Branch Email is Required"
                                }
                            }
                        },managerName: {
                            validators: {
                                notEmpty: {
                                    message: "Manager Name is Required"
                                }
                            }
                        },managerEmail: {
                            validators: {
                                notEmpty: {
                                    message: "Manager Email is Required"
                                }
                            }
                        },managerMobile: {
                            validators: {
                                notEmpty: {
                                    message: "Manager Mobile No. is Required"
                                }
                            }
                        },address: {
                            validators: {
                                notEmpty: {
                                    message: "Branch Address is Required"
                                }
                            }
                        },
                        serialToUse : {
                            validators : {
                                notEmpty : {
                                    message : "Please Select Any 1 Of Them"
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
                            fetchPostRequest("/masters/godowns/new", data, "Godown Added Successfully", i );
                           


                        }), )) : Swal.fire({
                            text: "Sorry, looks like there are some errors detected, please try again.",
                            icon: "error",
                            buttonsStyling: !1,
                            confirmButtonText: "Ok, got it!",
                            customClass: {
                                confirmButton: "btn btn-primary"
                            }
                        })
                    }))
                })), t.querySelector('[data-kt-users-modal-action="cancel"]').addEventListener("click", (t => {
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
                })), t.querySelector('[data-kt-users-modal-action="close"]').addEventListener("click", (t => {
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
            })()
        }
    }
}();
KTUtil.onDOMContentLoaded((function() {
    KTUsersAddUser.init()
}));