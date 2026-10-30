package com.photographplatform.api.privacy.api;

import com.photographplatform.api.auth.service.OwnershipGuard;
import com.photographplatform.api.common.security.AllowedWhenReadOnly;
import com.photographplatform.api.common.security.ClientIp;
import com.photographplatform.api.privacy.application.PersonalDataErasureService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A person's right to erasure, exercised by the studio that holds their data.
 *
 * <p>The studio is the controller of its clients' data, so a request reaches
 * the photographer and is carried out here. Preview first, then erase: the
 * second is irreversible and removes delivered galleries.
 *
 * <p>Owner only — it deletes the studio's records across every module.
 * {@link AllowedWhenReadOnly} because the duty to erase does not lapse with
 * the subscription: a locked account must still be able to honour a request.
 */
@RestController
@RequestMapping("/api/privacy")
@AllowedWhenReadOnly
public class PrivacyController {

    private final PersonalDataErasureService erasureService;
    private final OwnershipGuard ownershipGuard;

    public PrivacyController(PersonalDataErasureService erasureService, OwnershipGuard ownershipGuard) {
        this.erasureService = erasureService;
        this.ownershipGuard = ownershipGuard;
    }

    /** What erasing this address would do. Changes nothing. A POST only to keep the address out of URLs. */
    @PostMapping("/erasure/preview")
    public ErasureReportResponse preview(@Valid @RequestBody ErasureRequest request) {
        ownershipGuard.requireOwner();
        return ErasureReportResponse.of(false, erasureService.preview(request.email()));
    }

    @PostMapping("/erasure")
    public ErasureReportResponse erase(@Valid @RequestBody ErasureRequest request, HttpServletRequest http) {
        ownershipGuard.requireOwner();
        return ErasureReportResponse.of(true, erasureService.erase(request.email(), ClientIp.from(http)));
    }
}
