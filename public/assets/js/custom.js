function fetchGetRequest(url, val) {
    return fetch(`${url}`, {
      method: 'GET',
    }).then((data) => {
      if (data.status === 400) {
        return data.json().then((message) => {
          Swal.fire({
            text: message.message,
            icon: 'error',
            buttonsStyling: !1,
            confirmButtonText: 'Ok, got it!',
            customClass: {
              confirmButton: 'btn btn-primary',
            },
          }).then((data) => {
            if (data.isConfirmed) {
              $("input").each(function () {
                $(this).prop("disabled", false);
            });
            $("select").each(function () {
                $(this).prop("disabled", false).select2()
            });

            $("#address").val("")
            $("#PAN").val("")
            $("#state").val(null).select2()
            $("#ledgerName").val("")

            }
          });
        });
      }
      if (data.status === 200) {
        return data.json().then((message) => {
          return message;
        });
      } else if (data.status === 500) {
        Swal.fire({
          text: 'Something Went Wrong',
          icon: 'error',
          buttonsStyling: !1,
          confirmButtonText: 'Ok, got it!',
          customClass: {
            confirmButton: 'btn btn-primary',
          },
        }).then((data) => {
          if (data.isConfirmed) {
            location.reload();
          }
        });
      } else if (data.status === 401) {
        Swal.fire({
          text: 'You are not authorized to perform this action',
          icon: 'error',
          buttonsStyling: !1,
          confirmButtonText: 'Ok, got it!',
          customClass: {
            confirmButton: 'btn btn-primary',
          },
        }).then((data) => {
          if (data.isConfirmed) {
            location.reload();
          }
        });
      }
    });
  }

  function fetchPostRequest(url, data, specialMessage, btn, btnClose) {
    return fetch(`${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
      body: data,
    }).then((data) => {
      if (data.status === 400) {

        return data.json().then((message) => {
         
          Swal.fire({
            text: message.message,
            icon: 'error',
            buttonsStyling: !1,
            confirmButtonText: 'Ok, got it!',
            customClass: {
              confirmButton: 'btn btn-primary',
            },
          }).then((data) => {
            if (data.isConfirmed) {
              if(btn) {
              btn.removeAttr("data-kt-indicator");
              btn.prop("disabled", false);
              btnClose.prop("disabled", false);
              
            }
            }
          });
        });
      }
      if (data.status === 200) {
        Swal.fire({
          text: specialMessage,
          icon: 'success',
          buttonsStyling: !1,
          confirmButtonText: 'Ok, got it!',
          customClass: {
            confirmButton: 'btn btn-primary',
          },
        }).then(()=> {
          location.reload();
         
        })
      } else if (data.status === 500) {
        Swal.fire({
          text: 'Something Went Wrong',
          icon: 'error',
          buttonsStyling: !1,
          confirmButtonText: 'Ok, got it!',
          customClass: {
            confirmButton: 'btn btn-primary',
          },
        }).then((data) => {
          if (data.isConfirmed) {
            location.reload();
          }
        });
      } else if (data.status === 401) {
        Swal.fire({
          text: 'You are not authorized to perform this action',
          icon: 'error',
          buttonsStyling: !1,
          confirmButtonText: 'Ok, got it!',
          customClass: {
            confirmButton: 'btn btn-primary',
          },
        }).then((data) => {
          if (data.isConfirmed) {
            location.reload();
            if(btn) {
              btn.setAttribute('data-kt-indicator', "off")
              btn.disabled = !1
              btnClose.disabled = !1
          }
        }
        });
      }
    });
  }

  function fetchPostRequestAndReturnData(url, data, btn) {
    return fetch(`${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: data,
    }).then((response) => {
      if (response.status === 200) {
        return response.json().then((message) => {
          return message;
        });
      } else if (response.status === 400) {
        return response.json().then((message) => {
          Swal.fire({
            text: message.message,
            icon: 'error',
            buttonsStyling: !1,
            confirmButtonText: 'Ok, got it!',
            customClass: {
              confirmButton: 'btn btn-primary',
            },
          }).then((result) => {
            if (btn) {
              btn.setAttribute('data-kt-indicator', "off")
              btn.disabled = false;
            }
          });
        });
      } else if (response.status === 500) {
        Swal.fire({
          text: 'Something Went Wrong',
          icon: 'error',
          buttonsStyling: !1,
          confirmButtonText: 'Ok, got it!',
          customClass: {
            confirmButton: 'btn btn-primary',
          },
        }).then((result) => {
          if (result.isConfirmed) {
            location.reload();
          }
        });
      } else if (response.status === 401) {
        Swal.fire({
          text: 'You are not authorized to perform this action',
          icon: 'error',
          buttonsStyling: !1,
          confirmButtonText: 'Ok, got it!',
          customClass: {
            confirmButton: 'btn btn-primary',
          },
        }).then((result) => {
          if (result.isConfirmed) {
            location.reload();
            if (btn) {
              btn.setAttribute('data-kt-indicator', "off")
              btn.disabled = false;
            }
          }
        });
      }
    });
  }
