"use strict";
var KTUsersAddPermission = function () {
    const t = document.getElementById("kt_modal_add_permission"),
        e = t.querySelector("#kt_modal_add_permission_form"),
        n = new bootstrap.Modal(t);
    return {
        init: function () {
            (() => {
                var o = FormValidation.formValidation(e, {
                    fields: {
                        permission_name: {
                            validators: {
                                notEmpty: {
                                    message: "Permission name is required"
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
                            const formData = new FormData(e);
                            const formDataObject = {};
                            // Iterate through FormData and construct an object
                            formData.forEach((value, key) => {
                                formDataObject[key] = value;
                            });
                            fetch("/settings/whitelisting", {
                                method: "POST",
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                },
                                body: new URLSearchParams(formDataObject).toString()
                            }).then((data)=> {
                                if(data.status === 500) {
                                    alert("Something Went Wrong")
                                } else if(data.status === 400) {

                                    // When permission already exists
                                    Swal.fire({
                                        text: "Please enter a valid IP Address",
                                        icon : "error",
                                        buttonsStyling : !1,
                                        confirmButtonText : "Ok, got it!",
                                        customClass : {
                                            confirmButton : "btn-primary btn"
                                        }
                                    }).then((data)=> {
                                        if(data.isConfirmed) {
                                            i.setAttribute("data-kt-indicator", "off")
                                             i.disabled = 0
                                             n.hide()
                                            e.reset()
                                        }
                                    })
                                } else if(data.status === 200) {
                                    //when permission is craeted successfully
                                    Swal.fire({
                                        text: "Successfully Addedd Ip Address",
                                        icon : "success",
                                        buttonsStyling : !1,
                                        confirmButtonText : "Ok, got it!",
                                        customClass : {
                                            confirmButton : "btn-primary btn"
                                        }
                                    }).then(function(result) {
                                        if (result.isConfirmed) {
                                            n.hide();
                                            location.reload()
                                        }
                                    });
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
                                
                                     }   else if(data.status === 300) {
                                        Swal.fire({
                                            text: "This IP Address is already added",
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


                        }),)) : Swal.fire({
                            text: "Sorry, looks like there are some errors detected, please try again.",
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