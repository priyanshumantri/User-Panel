"use strict";
var KTUsersAddPermission = function () {
    const t = document.getElementById("kt_modal_add_permission"),
        e = t.querySelector("#newSeries"),
        n = new bootstrap.Modal(t);
    return {
        init: function () {
            (() => {
                var o = FormValidation.formValidation(e, {
                    fields: {
                        branch: {
                            validators: {
                                notEmpty: {
                                    message: "This is a required field"
                                }
                            }
                        },godown: {
                            validators: {
                                notEmpty: {
                                    message: "This is a required field"
                                }
                            }
                        },for: {
                            validators: {
                                notEmpty: {
                                    message: "This is a required field"
                                }
                            }
                        },start: {
                            validators: {
                                notEmpty: {
                                    message: "This is a required field"
                                }
                            }
                        },end: {
                            validators: {
                                notEmpty: {
                                    message: "This is a required field"
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
                t.querySelector('[data-kt-permissions-modal-action="close"]').addEventListener("click", (t => {
                    t.preventDefault(), Swal.fire({
                        text: "Are you sure you would like to close?",
                        icon: "warning",
                        showCancelButton: !0,
                        buttonsStyling: !1,
                        confirmButtonText: "Yes, close it!",
                        cancelButtonText: "No, return",
                        customClass: {
                            confirmButton: "btn btn-primary",
                            cancelButton: "btn btn-active-light"
                        }
                    }).then((function (t) {
                        t.value && n.hide()
                    }))
                })), t.querySelector('[data-kt-permissions-modal-action="cancel"]').addEventListener("click", (t => {
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
                    }).then((function (t) {
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
                }));
                const i = t.querySelector('[data-kt-permissions-modal-action="submit"]');
                i.addEventListener("click", (function (t) {
                    t.preventDefault(), o && o.validate().then((function (t) {
                        console.log("validated!"), "Valid" == t ? (i.setAttribute("data-kt-indicator", "on"), i.disabled = !0, setTimeout((function () {
                            
                          
                            const data = new URLSearchParams();
                            for (const pair of new FormData(e)) {
                                data.append(pair[0], pair[1]);
                            }
                
                            fetch("/settings/series-assign/new", {
                                method: "POST",
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                body: data
                            }).then((response) => {
                                if (response.status === 400) {
                                    return response.json().then((data) => {
                                        Swal.fire({
                                            text: data.message,
                                            icon: "error",
                                            buttonsStyling: false,
                                            confirmButtonText: "Ok, got it!",
                                            customClass: {
                                                confirmButton: "btn btn-primary"
                                            }
                                        }).then((data)=> {
                                            if(data.isConfirmed) {
                                                i.setAttribute("data-kt-indicator", "off")
                                                i.disabled = 0
                                            }
                                        })
                                    })
                                } else if (response.status === 200) {
                                    Swal.fire({
                                        text: "New Series Assigned Successfully",
                                        icon: "success",
                                        buttonsStyling: false,
                                        confirmButtonText: "Ok, got it!",
                                        customClass: {
                                            confirmButton: "btn btn-primary"
                                        }
                                    }).then((response)=> {
                                        if(response.isConfirmed) {
                                            location.reload()
                                        }
                                    })
                                }
                            })


                        }),)) : Swal.fire({
                            text: "Please fill all required fields",
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
KTUtil.onDOMContentLoaded((function () {
    KTUsersAddPermission.init()
}));

