const handleSubmit = async (e) => {

    e.preventDefault();

    try {

        const response = await authService.login(form);

        localStorage.setItem("token", response.token);
        localStorage.setItem("user", JSON.stringify(response.user));

        switch (response.user.role) {

            case "super_admin":
                navigate("/super_admin");
                break;

            case "admin":
                navigate("/admin/dashboard");
                break;

            case "cashier":
                navigate("/cashier");
                break;

            case "waiter":
                navigate("/waiter");
                break;

            case "kitchen":
                navigate("/kitchen");
                break;

            default:
                navigate("/");
        }

    } catch (err) {

        setError(
            err.response?.data?.message || "Login failed."
        );

    }

};
